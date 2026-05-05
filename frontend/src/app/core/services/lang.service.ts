import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LangService {
  private readonly LANG_KEY = 'tf_lang';

  getCurrentLang(): string {
    return localStorage.getItem(this.LANG_KEY) || 'ar';
  }

  setLang(lang: 'ar' | 'en') {
    localStorage.setItem(this.LANG_KEY, lang);
    this.applyDir(lang);
  }

  applyDir(lang: string) {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', lang);
    document.body.classList.toggle('rtl', lang === 'ar');
    document.body.classList.toggle('ltr', lang !== 'ar');
  }

  isRtl(): boolean {
    return this.getCurrentLang() === 'ar';
  }
}
