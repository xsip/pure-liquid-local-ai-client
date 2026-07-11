import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiUnauthorizedResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiQuery,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { randomUUID } from 'crypto';
import { Public } from './public.decorator';
import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';
import { User, UserDocument } from './user.schema';
import { CurrentUser } from './current-user.decorator';
import { TokenLimitService } from '../token-limit/token-limit.service';
import { MeDto } from './me.dto';
import { AddCustomMcpDto, CustomMcpDto, UpdateCustomMcpDto } from './dto/custom-mcp.dto';
import { McpClientService } from '../mcp-client/mcp-client.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly tokenLimitService: TokenLimitService,
    private readonly mcpClientService: McpClientService,
  ) {}

  // ── GET /auth/me ──────────────────────────────────────────────────────────

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    operationId: 'getMe',
    summary: 'Get the currently authenticated user',
  })
  @ApiOkResponse({
    description: 'Returns public user profile data',
    type: MeDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  async getMe(
    @CurrentUser() user: User & { _id?: Types.ObjectId },
  ): Promise<MeDto> {
    const tokenLimit = await this.tokenLimitService.getTokensPerIntervall(
      user.subscription as any,
    );

    return {
      username: user.username,
      role: user.role,
      subscription: user.subscription,
      isActivated: user.isActivated,
      usedTokens: user.usedTokens ?? 0,
      tokenCountResetDate: user.tokenCountResetDate ?? null,
      tokenLimit,
      customMcps: user.customMcps ?? [],
    };
  }

  // ── Custom MCP servers ────────────────────────────────────────────────────

  @Post('mcp-servers')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({
    operationId: 'addCustomMcpServer',
    summary: 'Register a custom MCP server on the current account',
    description:
      'Connects to the given endpoint, fetches its name and tool list, and ' +
      'stores it (active + all tools allowed by default).',
  })
  @ApiBody({ type: AddCustomMcpDto })
  @ApiCreatedResponse({ type: CustomMcpDto })
  async addCustomMcpServer(
    @CurrentUser() user: User & { _id?: Types.ObjectId },
    @Body() dto: AddCustomMcpDto,
  ): Promise<CustomMcpDto> {
    const { name, tools } = await this.mcpClientService.discoverServer(
      dto.endpoint,
      dto.headers,
    );

    const entry: CustomMcpDto = {
      id: randomUUID(),
      name,
      endpoint: dto.endpoint,
      active: true,
      availableTools: tools,
      allowedTools: tools,
      headers: dto.headers,
    };

    const doc = await this.userModel.findById(user._id).exec();
    if (!doc) throw new NotFoundException('User not found');
    doc.customMcps = [...(doc.customMcps ?? []), entry];
    await doc.save();

    return entry;
  }

  @Patch('mcp-servers/:id')
  @ApiBearerAuth()
  @ApiOperation({
    operationId: 'updateCustomMcpServer',
    summary: 'Toggle a custom MCP server on/off or edit its allowed tools',
  })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateCustomMcpDto })
  @ApiOkResponse({ type: CustomMcpDto })
  @ApiNotFoundResponse({ description: 'No MCP server with this id' })
  async updateCustomMcpServer(
    @CurrentUser() user: User & { _id?: Types.ObjectId },
    @Param('id') id: string,
    @Body() dto: UpdateCustomMcpDto,
  ): Promise<CustomMcpDto> {
    const doc = await this.userModel.findById(user._id).exec();
    if (!doc) throw new NotFoundException('User not found');
    const entry = (doc.customMcps ?? []).find((m) => m.id === id);
    if (!entry) throw new NotFoundException(`No MCP server with id "${id}"`);

    Object.assign(entry, dto);
    doc.markModified('customMcps');
    await doc.save();

    return entry;
  }

  @Post('mcp-servers/:id/refresh')
  @ApiBearerAuth()
  @ApiOperation({
    operationId: 'refreshCustomMcpServer',
    summary: 'Re-discover a custom MCP server\'s tool list',
    description:
      'Re-connects to the server\'s endpoint and refreshes availableTools. ' +
      'Newly discovered tools are allowed by default; tools that disappeared ' +
      'are dropped from allowedTools; existing allow/deny choices are preserved.',
  })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: CustomMcpDto })
  @ApiNotFoundResponse({ description: 'No MCP server with this id' })
  async refreshCustomMcpServer(
    @CurrentUser() user: User & { _id?: Types.ObjectId },
    @Param('id') id: string,
  ): Promise<CustomMcpDto> {
    const doc = await this.userModel.findById(user._id).exec();
    if (!doc) throw new NotFoundException('User not found');
    const entry = (doc.customMcps ?? []).find((m) => m.id === id);
    if (!entry) throw new NotFoundException(`No MCP server with id "${id}"`);

    const { name, tools } = await this.mcpClientService.discoverServer(
      entry.endpoint,
      entry.headers,
    );

    const keptAllowed = entry.allowedTools.filter((t) => tools.includes(t));
    const newlyDiscovered = tools.filter((t) => !entry.availableTools.includes(t));

    entry.name = name;
    entry.availableTools = tools;
    entry.allowedTools = [...keptAllowed, ...newlyDiscovered];

    doc.markModified('customMcps');
    await doc.save();

    return entry;
  }

  @Delete('mcp-servers/:id')
  @ApiBearerAuth()
  @ApiOperation({
    operationId: 'deleteCustomMcpServer',
    summary: 'Remove a custom MCP server from the current account',
  })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ description: 'Server removed' })
  async deleteCustomMcpServer(
    @CurrentUser() user: User & { _id?: Types.ObjectId },
    @Param('id') id: string,
  ): Promise<{ id: string }> {
    const doc = await this.userModel.findById(user._id).exec();
    if (!doc) throw new NotFoundException('User not found');
    doc.customMcps = (doc.customMcps ?? []).filter((m) => m.id !== id);
    await doc.save();

    return { id };
  }

  // ── POST /auth/login ──────────────────────────────────────────────────────

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'login', summary: 'Log in and receive a JWT' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ description: 'Returns a signed JWT string' })
  @ApiUnauthorizedResponse({ description: 'Wrong username or password' })
  async login(@Body() dto: LoginDto): Promise<string> {
    const user = await this.userModel
      .findOne({ username: dto.user.toLowerCase() })
      .exec();

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('CMS_LOGIN_ERROR_WRONG');
    }

    if (!user.isActivated)
      throw new UnauthorizedException('CMS_LOGIN_ERROR_NOT_ACTIVATED');

    return this.jwtService.sign(
      { user: user.username, role: user.role },
      { expiresIn: '1h' },
    );
  }

  // ── POST /auth/register ───────────────────────────────────────────────────

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    operationId: 'register',
    summary: 'Register a new user',
    description:
      'Requires a valid `REGISTER_SECRET` env value in the request body to prevent open registration. ' +
      'Returns the generated activation hash (to be sent via email in a real deployment).',
  })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({
    description: 'User created — returns the activation hash in dev mode',
  })
  @ApiUnauthorizedResponse({ description: 'Invalid register secret' })
  @ApiConflictResponse({ description: 'Username or email already taken' })
  async register(
    @Body() dto: RegisterDto,
  ): Promise<{ activationHash?: string }> {
    if (dto.registerSecret !== process.env.REGISTER_SECRET) {
      throw new UnauthorizedException('Invalid register secret');
    }

    const existingByUsername = await this.userModel
      .findOne({ username: dto.username.toLowerCase() })
      .exec();

    if (existingByUsername) {
      throw new ConflictException(
        `Username "${dto.username}" is already registered`,
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Generate a random MD5 activation hash
    const activationHash = crypto
      .createHash('md5')
      .update(crypto.randomBytes(32))
      .digest('hex');

    await this.userModel.create({
      username: dto.username.toLowerCase(),
      passwordHash,
      role: 'user',
      isActivated: false,
      activationHash,
    });

    // Only expose the hash in the response when explicitly enabled (e.g. local dev).
    // In production, email the hash to the user and leave this env var unset.
    return {
      activationHash:
        process.env.RETURN_REGISTER_HASH === 'true'
          ? activationHash
          : undefined,
    };
  }

  // ── GET /auth/activate ────────────────────────────────────────────────────

  @Public()
  @Get('activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'activateAccount',
    summary: 'Activate a user account',
    description:
      'Verifies the activation hash and marks the account as active. ' +
      'Returns a signed JWT so the user is immediately logged in after activation.',
  })
  @ApiQuery({
    name: 'hash',
    required: true,
    description: 'The MD5 activation hash from the registration response',
  })
  @ApiOkResponse({ description: 'Account activated — returns a signed JWT' })
  @ApiNotFoundResponse({
    description: 'Invalid or already-used activation hash',
  })
  async activate(@Query('hash') hash: string): Promise<string> {
    const user = await this.userModel.findOne({ activationHash: hash }).exec();

    if (!user) {
      throw new NotFoundException('Invalid or already-used activation hash');
    }

    user.isActivated = true;
    user.activationHash = null; // consume the hash so it cannot be reused
    await user.save();

    return this.jwtService.sign(
      { user: user.username, role: user.role },
      { expiresIn: '1h' },
    );
  }
}
