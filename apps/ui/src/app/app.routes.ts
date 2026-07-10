import { Routes } from '@angular/router';
import { OpenAiApi } from './routes/openai-api';
import { Login } from './routes/login';
import { ReadmeComponent } from './routes/readme';
import { AdminCms } from './routes/admin';
import { authGuard } from './auth.guard';
import { adminGuard } from './admin.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'readme',
    pathMatch: 'full',
  },
  {
    path: 'readme',
    component: ReadmeComponent,
    pathMatch: 'full',
  },
  {
    path: 'chat-openai',
    pathMatch: 'full',
    canActivate: [authGuard],
    component: OpenAiApi,
  },
  {
    path: 'chat-openai/:chatId',
    pathMatch: 'full',
    runGuardsAndResolvers: 'paramsChange',
    canActivate: [authGuard],
    component: OpenAiApi,
  },
  {
    path: 'admin',
    pathMatch: 'full',
    canActivate: [authGuard, adminGuard],
    component: AdminCms,
  },
  {
    path: 'login',
    pathMatch: 'full',
    component: Login,
  },
];
