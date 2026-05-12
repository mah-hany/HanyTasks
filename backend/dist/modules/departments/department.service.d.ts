export declare const departmentService: {
    getAll(): Promise<({
        manager: {
            id: number;
            fullName: string;
            fullNameAr: string;
        } | null;
        _count: {
            users: number;
        };
        parent: {
            id: number;
            name: string;
            nameAr: string;
        } | null;
        children: {
            id: number;
            name: string;
            nameAr: string;
        }[];
    } & {
        id: number;
        managerId: number | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        nameAr: string;
        code: string;
        parentId: number | null;
    })[]>;
    getTree(): Promise<any[]>;
    create(data: {
        name: string;
        nameAr: string;
        code: string;
        parentId?: number;
        managerId?: number;
    }): Promise<{
        manager: {
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
        } | null;
        parent: {
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
    } & {
        id: number;
        managerId: number | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        nameAr: string;
        code: string;
        parentId: number | null;
    }>;
    update(id: number, data: any): Promise<{
        id: number;
        managerId: number | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        nameAr: string;
        code: string;
        parentId: number | null;
    }>;
    delete(id: number): Promise<{
        id: number;
        managerId: number | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        nameAr: string;
        code: string;
        parentId: number | null;
    }>;
};
//# sourceMappingURL=department.service.d.ts.map