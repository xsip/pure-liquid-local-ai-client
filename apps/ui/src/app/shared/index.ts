// ── UI Kit ─────────────────────────────────────────────────────────────────
export { ButtonComponent }        from './components/ui/button.component';
export { IconButtonComponent }    from './components/ui/icon-button.component';
export { BadgeComponent }         from './components/ui/badge.component';
export { LabelComponent }         from './components/ui/label.component';
export { TextInputComponent }     from './components/ui/text-input.component';
export { ToggleComponent }        from './components/ui/toggle.component';
export { DarkModeToggleComponent } from './components/ui/dark-mode-toggle.component';
export { ModalComponent }         from './components/ui/modal.component';

// ── Shared Components ──────────────────────────────────────────────────────
export { SpinnerComponent }       from './components/spinner.component';
export { SendButtonComponent }    from './components/send-button.component';
export { ResetButtonComponent }   from './components/reset-button.component';
export {
  ReasoningDropdownComponent,
  ALL_REASONING_OPTIONS,
}                                 from './components/reasoning-dropdown.component';
export type { ReasoningOption, ModelReasoningCapability }
                                  from './components/reasoning-dropdown.component';

export { ChatSettingsDialogComponent } from './components/chat-settings-dialog.component';
export type { ChatSettingsData, ChatSettingsSaveEvent }
                                  from './components/chat-settings-dialog.component';

// ── Shared Utils ───────────────────────────────────────────────────────────
export {
  lastIndexWhere,
  patchLast,
  patchByItemId,
  finalizeStreamingMessages,
  safeParseJson,
}                                 from './utils/chat-message.utils';
export type { ChatMessage }       from './utils/chat-message.utils';

export {
  fileSizeLabel,
  readFilesAsDataUrls,
  mergeFiles,
}                                 from './utils/file.utils';
export type { AppendedFile }      from './utils/file.utils';

export { readStoredTheme, applyTheme } from './utils/theme.utils';

// ── Directives ─────────────────────────────────────────────────────────────
export { TooltipDirective } from './directives/tooltip.directive';
