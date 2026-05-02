import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ImageBlobDocument = ImageBlob & Document;

@Schema({ collection: 'image_blobs', timestamps: true })
export class ImageBlob {
  @Prop({ required: true, lowercase: true, trim: true })
  userId: string;

  @Prop({ required: true, lowercase: true, trim: true })
  chatId: string;

  /** Original file name (sanitised) */
  @Prop({ required: true })
  filename: string;

  /** Original file name (sanitised) */
  @Prop({ required: true })
  displayName: string;

  /** MIME type, e.g. image/jpeg */
  @Prop({ required: true })
  mimeType: string;

  /** Raw binary data stored as a Buffer in MongoDB */
  @Prop({ required: true, type: Buffer })
  data: Buffer;
  /** Raw binary data stored as a Buffer in MongoDB */
  @Prop({ required: false, type: Buffer })
  thumbnailData: Buffer;
}

export const ImageBlobSchema = SchemaFactory.createForClass(ImageBlob);

// Index for fast lookups by tenant + filename
ImageBlobSchema.index({ tenant: 1, filename: 1 }, { unique: true });
