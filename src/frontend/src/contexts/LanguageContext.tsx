import { i18n } from '@lingui/core';
import { t } from '@lingui/macro';
import { I18nProvider } from '@lingui/react';
import { useEffect } from 'react';

import { api } from '../App';
import { useLocalState } from '../states/LocalState';

// Definitions
export type Locales =
  | 'cs'
  | 'da'
  | 'de'
  | 'el'
  | 'en'
  | 'es'
  | 'es-mx'
  | 'fa'
  | 'fi'
  | 'fr'
  | 'he'
  | 'hi'
  | 'hu'
  | 'it'
  | 'ja'
  | 'ko'
  | 'nl'
  | 'no'
  | 'pl'
  | 'pt'
  | 'pt-br'
  | 'ru'
  | 'sl'
  | 'sv'
  | 'th'
  | 'tr'
  | 'vi'
  | 'zh-hans'
  | 'zh-hant'
  | 'pseudo-LOCALE';

export const languages: Record<Locales, string> = {
  cs: t`Czech`,
  da: t`Danish`,
  de: t`German`,
  el: t`Greek`,
  en: t`English`,
  es: t`Spanish`,
  'es-mx': t`Spanish (Mexican)`,
  fa: t`Farsi / Persian`,
  fi: t`Finnish`,
  fr: t`French`,
  he: t`Hebrew`,
  hi: t`Hindi`,
  hu: t`Hungarian`,
  it: t`Italian`,
  ja: t`Japanese`,
  ko: t`Korean`,
  nl: t`Dutch`,
  no: t`Norwegian`,
  pl: t`Polish`,
  pt: t`Portuguese`,
  'pt-br': t`Portuguese (Brazilian)`,
  ru: t`Russian`,
  sl: t`Slovenian`,
  sv: t`Swedish`,
  th: t`Thai`,
  tr: t`Turkish`,
  vi: t`Vietnamese`,
  'zh-hans': t`Chinese (Simplified)`,
  'zh-hant': t`Chinese (Traditional)`,
  'pseudo-LOCALE': t`Pseudo Locale`
};

export function LanguageContext({ children }: { children: JSX.Element }) {
  const [language] = useLocalState((state) => [state.language]);

  useEffect(() => {
    activateLocale(language);
  }, [language]);

  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}

export async function activateLocale(locale: Locales) {
  const { messages } = await import(`../locales/${locale}/messages.ts`);
  i18n.load(locale, messages);
  i18n.activate(locale);

  // Set api header
  api.defaults.headers.common['Accept-Language'] = locale;
}
