import { InjectionToken } from '@angular/core';

/**
 * Whether the "Go to Chat" link should render in the shared ReadmeComponent.
 * True in the `ui` app (which actually has a /chat-openai route), false by
 * default everywhere else (e.g. the `landing` app, which only hosts the docs).
 */
export const SHOW_CHAT_LINK = new InjectionToken<boolean>('SHOW_CHAT_LINK', {
  providedIn: 'root',
  factory: () => false,
});
