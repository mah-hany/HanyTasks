export declare const userService: {
    getAll(filters: {
        departmentId?: number;
        roleId?: number;
        isActive?: boolean;
        search?: string;
    }): Promise<{
        id: number;
        employeeCode: string;
        username: string;
        email: string;
        fullName: string;
        fullNameAr: string;
        phone: string | null;
        isActive: boolean;
        profilePhoto: string | null;
        createdAt: Date;
        lastLoginAt: Date | null;
        role: {
            level: number;
            id: number;
            name: string;
            nameAr: string;
        };
        department: {
            id: number;
            name: string;
            nameAr: string;
        } | null;
        manager: {
            id: number;
            employeeCode: string;
            fullName: string;
            fullNameAr: string;
        } | null;
    }[]>;
    getById(id: number): Promise<{
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
        subordinates: {
            id: number;
            employeeCode: string;
            fullName: string;
            fullNameAr: string;
        }[];
        tasksAssigned: ({
            category: {
                id: number;
                name: string;
                nameAr: string;
                color: string;
                icon: string;
            } | null;
        } & {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            assignedToId: number;
            status: string;
            description: string | null;
            title: string;
            titleAr: string | null;
            taskCode: string;
            categoryId: number | null;
            priority: string;
            createdById: number;
            startDate: Date | null;
            dueDate: Date | null;
            completedDate: Date | null;
            progressPercent: number;
        })[];
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
    create(data: {
        fullName: string;
        fullNameAr: string;
        username: string;
        email: string;
        phone?: string;
        departmentId?: number;
        roleId: number;
        managerId?: number;
        password?: string;
    }): Promise<{
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
        id: number;
        employeeCode: string;
        username: string;
        email: string;
        telegramChatId: string | null;
        fullName: string;
        fullNameAr: string;
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
    update(id: number, data: Partial<{
        fullName: string;
        fullNameAr: string;
        email: string;
        phone: string;
        departmentId: number;
        roleId: number;
        managerId: number;
        isActive: boolean;
        profilePhoto: string;
        preferredLang: string;
    }>): Promise<{
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
    resetPassword(id: number, newPassword: string): Promise<{
        message: string;
    }>;
    getCredentials(): Promise<{
        id: number;
        employeeCode: string;
        username: string;
        email: string;
        fullName: string;
        fullNameAr: string;
        plainPassword: string | null;
        phone: string | null;
        isActive: boolean;
        createdAt: Date;
        lastLoginAt: Date | null;
        role: {
            level: number;
            name: string;
            nameAr: string;
        };
        department: {
            name: string;
            nameAr: string;
        } | null;
    }[]>;
    transfer(userId: number, toDeptId: number, note: string, transferredById: number): Promise<{
        id: number;
        employeeCode: string;
        username: string;
        email: string;
        telegramChatId: string | null;
        fullName: string;
        fullNameAr: string;
        passwordHash: string;
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
    getOrgTree(): Promise<any[]>;
    delete(id: number): Promise<{
        message: string;
    }>;
};
//# sourceMappingURL=user.service.d.ts.map