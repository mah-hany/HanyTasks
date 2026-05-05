import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { LangService } from './core/services/lang.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class App implements OnInit {
  constructor(
    private translate: TranslateService,
    private langService: LangService,
  ) {}

  ngOnInit() {
    const savedLang = this.langService.getCurrentLang();
    this.translate.setDefaultLang('ar');
    this.translate.use(savedLang);
    this.langService.applyDir(savedLang);
  }
}
