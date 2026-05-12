export declare const authService: {
    login(username: string, password: string, ip?: string): Promise<{
        accessToken: string;
        refreshToken: string;
        isFirstLogin: boolean;
        user: {
            id: number;
            employeeCode: string;
            fullName: string;
            fullNameAr: string;
            username: string;
            email: string;
            profilePhoto: string | null;
            preferredLang: string;
            role: {
                id: number;
                name: string;
                nameAr: string;
                level: number;
            };
            department: {
                id: number;
                name: string;
                nameAr: string;
            } | null;
        };
    }>;
    refresh(refreshToken: string): Promise<{
        accessToken: string;
    }>;
    changePassword(userId: number, oldPassword: string, newPassword: string): Promise<{
        message: string;
    }>;
    forgotPassword(email: string): Promise<{
        message: string;
    }>;
    resetPasswordWithToken(token: string, newPassword: string): Promise<{
        message: string;
    }>;
    getProfile(userId: number): Promise<{
        role: {
            level: number;
            id: number;
            name: string;
            nameAr: string;
        };
        department: {
            id: number;
            managerId: number | null;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            nameAr: string;
            code: string;
            parentId: number | null;
        } | null;
        manager: {
            id: number;
            employeeCode: string;
            fullName: string;
            fullNameAr: string;
        } | null;
        id: number;
        employeeCode: string;
        username: string;
        email: string;
        telegramChatId: string | null;
        fullName: string;
        fullNameAr: string;
        plainPassword: string | null;
        phone: string | null;
        departmentId: number | null;
        roleId: number;
        managerId: number | null;
        isActive: boolean;
        isFirstLogin: boolean;
        failedLoginCount: number;
        lockedUntil: Date | null;
        profilePhoto: string | null;
        preferredLang: string;
        createdAt: Date;
        updatedAt: Date;
        lastLoginAt: Date | null;
        resetToken: string | null;
        resetTokenExpiry: Date | null;
    }>;
};
//# sourceMappingURL=auth.service.d.ts.map