import sys

path = r'src/app/features/extracts/extracts-page.component.ts'
with open(path, encoding='utf-8') as f:
    content = f.read()

old_html = """  <!-- Financial Summary Banner -->
  <div class="financial-banner tf-card" *ngIf="financialSummary()">
    <div class="fin-title">
      <mat-icon>account_balance_wallet</mat-icon>
      {{ isAr() ? 'ملخص مالي' : 'Financial Summary' }}
    </div>
    <div class="fin-cards">
      <div class="fin-card amber">
        <span class="fin-label">{{ isAr() ? 'مستلم' : 'Received' }}</span>
        <span class="fin-amount">{{ formatAmount(financialSummary()?.byStatus?.[0]?.total) }}</span>
        <span class="fin-count">{{financialSummary()?.byStatus?.[0]?.count}} {{ isAr() ? 'مستخلص' : 'extracts' }}</span>
      </div>
      <div class="fin-card blue">
        <span class="fin-label">{{ isAr() ? 'مراجعة' : 'Under Review' }}</span>
        <span class="fin-amount">{{ formatAmount(financialSummary()?.byStatus?.[1]?.total) }}</span>
        <span class="fin-count">{{financialSummary()?.byStatus?.[1]?.count}} {{ isAr() ? 'مستخلص' : 'extracts' }}</span>
      </div>
      <div class="fin-card green">
        <span class="fin-label">{{ isAr() ? 'مُدرج' : 'Posted' }}</span>
        <span class="fin-amount">{{ formatAmount(financialSummary()?.byStatus?.[2]?.total) }}</span>
        <span class="fin-count">{{financialSummary()?.byStatus?.[2]?.count}} {{ isAr() ? 'مستخلص' : 'extracts' }}</span>
      </div>
      <div class="fin-card red">
        <span class="fin-label">{{ isAr() ? 'مُرجَع' : 'Returned' }}</span>
        <span class="fin-amount">{{ formatAmount(financialSummary()?.byStatus?.[3]?.total) }}</span>
        <span class="fin-count">{{financialSummary()?.byStatus?.[3]?.count}} {{ isAr() ? 'مستخلص' : 'extracts' }}</span>
      </div>
      <div class="fin-card grand">
        <span class="fin-label">{{ isAr() ? 'الإجمالي' : 'Grand Total' }}</span>
        <span class="fin-amount">{{ formatAmount(financialSummary()?.grandTotal) }}</span>
        <span class="fin-count">{{financialSummary()?.grandCount}} {{ isAr() ? 'مستخلص بمبالغ' : 'with amounts' }}</span>
      </div>
    </div>
  </div>"""

new_html = """  <!-- Financial Summary Banners (Per Currency) -->
  <div class="financial-summaries" *ngIf="financialSummary()?.length > 0">
    <div class="financial-banner tf-card" *ngFor="let fin of financialSummary()" style="margin-bottom: 16px;">
      <div class="fin-title">
        <mat-icon>account_balance_wallet</mat-icon>
        {{ isAr() ? 'ملخص مالي' : 'Financial Summary' }} ({{ fin.currency }})
      </div>
      <div class="fin-cards">
        <div class="fin-card amber">
          <span class="fin-label">{{ isAr() ? 'مستلم' : 'Received' }}</span>
          <span class="fin-amount">{{ formatAmount(fin.byStatus?.[0]?.total, fin.currency) }}</span>
          <span class="fin-count">{{fin.byStatus?.[0]?.count}} {{ isAr() ? 'مستخلص' : 'extracts' }}</span>
        </div>
        <div class="fin-card blue">
          <span class="fin-label">{{ isAr() ? 'مراجعة' : 'Under Review' }}</span>
          <span class="fin-amount">{{ formatAmount(fin.byStatus?.[1]?.total, fin.currency) }}</span>
          <span class="fin-count">{{fin.byStatus?.[1]?.count}} {{ isAr() ? 'مستخلص' : 'extracts' }}</span>
        </div>
        <div class="fin-card green">
          <span class="fin-label">{{ isAr() ? 'مُدرج' : 'Posted' }}</span>
          <span class="fin-amount">{{ formatAmount(fin.byStatus?.[2]?.total, fin.currency) }}</span>
          <span class="fin-count">{{fin.byStatus?.[2]?.count}} {{ isAr() ? 'مستخلص' : 'extracts' }}</span>
        </div>
        <div class="fin-card red">
          <span class="fin-label">{{ isAr() ? 'مُرجَع' : 'Returned' }}</span>
          <span class="fin-amount">{{ formatAmount(fin.byStatus?.[3]?.total, fin.currency) }}</span>
          <span class="fin-count">{{fin.byStatus?.[3]?.count}} {{ isAr() ? 'مستخلص' : 'extracts' }}</span>
        </div>
        <div class="fin-card grand">
          <span class="fin-label">{{ isAr() ? 'الإجمالي' : 'Grand Total' }}</span>
          <span class="fin-amount">{{ formatAmount(fin.grandTotal, fin.currency) }}</span>
          <span class="fin-count">{{fin.grandCount}} {{ isAr() ? 'مستخلص بمبالغ' : 'with amounts' }}</span>
        </div>
      </div>
    </div>
  </div>"""

old_format = """  formatAmount(amount: number | undefined | null): string {
    if (amount === null || amount === undefined) return '0';
    return new Intl.NumberFormat(this.isAr() ? 'ar-EG' : 'en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
  }"""

new_format = """  formatAmount(amount: number | undefined | null, currency?: string): string {
    if (amount === null || amount === undefined) return '0' + (currency ? ' ' + currency : '');
    const num = new Intl.NumberFormat(this.isAr() ? 'ar-EG' : 'en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
    return currency ? `${num} ${currency}` : num;
  }"""

changed1 = False
changed2 = False

if old_html in content:
    content = content.replace(old_html, new_html, 1)
    changed1 = True
elif old_html.replace('\n', '\r\n') in content:
    content = content.replace(old_html.replace('\n', '\r\n'), new_html, 1)
    changed1 = True

if old_format in content:
    content = content.replace(old_format, new_format, 1)
    changed2 = True
elif old_format.replace('\n', '\r\n') in content:
    content = content.replace(old_format.replace('\n', '\r\n'), new_format, 1)
    changed2 = True

if changed1 and changed2:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("SUCCESS")
else:
    print(f"FAILED. HTML: {changed1}, Format: {changed2}")
