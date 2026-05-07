export declare function initEmailService(): void;
export declare function sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
}): Promise<void>;
export declare function taskAssignedEmail(taskTitle: string, taskCode: string, employeeName: string, dueDate?: string): string;
export declare function weeklyReportEmail(employeeName: string, stats: {
    total: number;
    completed: number;
    overdue: number;
    rate: number;
}): string;
export declare function sendWeeklyReports(): Promise<void>;
//# sourceMappingURL=email.service.d.ts.map