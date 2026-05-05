import { TaskStatus, TaskPriority } from '../../types/enums';
export declare const taskService: {
    getAll(filters: {
        status?: TaskStatus;
        priority?: TaskPriority;
        assignedToId?: number;
        createdById?: number;
        categoryId?: number;
        departmentId?: number;
        search?: string;
        fromDate?: string;
        toDate?: string;
        userId?: number;
        userRoleLevel?: number;
    }): Promise<({
        _count: {
            comments: number;
            attachments: number;
        };
        category: {
            id: number;
            name: string;
            nameAr: string;
            color: string;
            icon: string;
        } | null;
        assignedTo: {
            id: number;
            employeeCode: string;
            fullName: string;
            fullNameAr: string;
            profilePhoto: string | null;
        };
        createdBy: {
            id: number;
            fullName: string;
            fullNameAr: string;
        };
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        description: string | null;
        title: string;
        titleAr: string | null;
        taskCode: string;
        categoryId: number | null;
        priority: string;
        assignedToId: number;
        createdById: number;
        startDate: Date | null;
        dueDate: Date | null;
        completedDate: Date | null;
        progressPercent: number;
    })[]>;
    getById(id: number): Promise<{
        category: {
            id: number;
            name: string;
            nameAr: string;
            color: string;
            icon: string;
        } | null;
        assignedTo: {
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
        } & {
            username: string;
            id: number;
            employeeCode: string;
            fullName: string;
            fullNameAr: string;
            passwordHash: string;
            email: string;
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
            telegramChatId: string | null;
            createdAt: Date;
            updatedAt: Date;
            lastLoginAt: Date | null;
        };
        createdBy: {
            id: number;
            fullName: string;
            fullNameAr: string;
        };
        statusHistory: ({
            changedBy: {
                id: number;
                fullName: string;
                fullNameAr: string;
                profilePhoto: string | null;
            };
        } & {
            id: number;
            note: string | null;
            taskId: number;
            changeDate: Date;
            fromStatus: string | null;
            toStatus: string;
            changedById: number;
        })[];
        comments: ({
            user: {
                id: number;
                fullName: string;
                fullNameAr: string;
                profilePhoto: string | null;
            };
        } & {
            id: number;
            userId: number;
            taskId: number;
            commentDate: Date;
            commentText: string;
            isManagerNote: boolean;
        })[];
        attachments: {
            id: number;
            taskId: number;
            fileName: string;
            fileUrl: string;
            fileSize: number;
            fileType: string;
            uploadedById: number;
            uploadedAt: Date;
        }[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        description: string | null;
        title: string;
        titleAr: string | null;
        taskCode: string;
        categoryId: number | null;
        priority: string;
        assignedToId: number;
        createdById: number;
        startDate: Date | null;
        dueDate: Date | null;
        completedDate: Date | null;
        progressPercent: number;
    }>;
    create(data: {
        title: string;
        titleAr?: string;
        description?: string;
        categoryId?: number;
        priority: TaskPriority;
        assignedToId: number;
        createdById: number;
        startDate?: string;
        dueDate?: string;
    }): Promise<{
        category: {
            id: number;
            name: string;
            nameAr: string;
            color: string;
            icon: string;
        } | null;
        assignedTo: {
            username: string;
            id: number;
            employeeCode: string;
            fullName: string;
            fullNameAr: string;
            passwordHash: string;
            email: string;
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
            telegramChatId: string | null;
            createdAt: Date;
            updatedAt: Date;
            lastLoginAt: Date | null;
        };
        createdBy: {
            username: string;
            id: number;
            employeeCode: string;
            fullName: string;
            fullNameAr: string;
            passwordHash: string;
            email: string;
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
            telegramChatId: string | null;
            createdAt: Date;
            updatedAt: Date;
            lastLoginAt: Date | null;
        };
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        description: string | null;
        title: string;
        titleAr: string | null;
        taskCode: string;
        categoryId: number | null;
        priority: string;
        assignedToId: number;
        createdById: number;
        startDate: Date | null;
        dueDate: Date | null;
        completedDate: Date | null;
        progressPercent: number;
    }>;
    updateStatus(taskId: number, newStatus: TaskStatus, userId: number, note?: string): Promise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        description: string | null;
        title: string;
        titleAr: string | null;
        taskCode: string;
        categoryId: number | null;
        priority: string;
        assignedToId: number;
        createdById: number;
        startDate: Date | null;
        dueDate: Date | null;
        completedDate: Date | null;
        progressPercent: number;
    }>;
    updateProgress(taskId: number, progress: number, userId: number): Promise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        description: string | null;
        title: string;
        titleAr: string | null;
        taskCode: string;
        categoryId: number | null;
        priority: string;
        assignedToId: number;
        createdById: number;
        startDate: Date | null;
        dueDate: Date | null;
        completedDate: Date | null;
        progressPercent: number;
    }>;
    addComment(taskId: number, userId: number, text: string, isManagerNote?: boolean): Promise<{
        user: {
            id: number;
            fullName: string;
            fullNameAr: string;
            profilePhoto: string | null;
        };
    } & {
        id: number;
        userId: number;
        taskId: number;
        commentDate: Date;
        commentText: string;
        isManagerNote: boolean;
    }>;
    getDashboardStats(userId: number, roleLevel: number): Promise<{
        total: number;
        inProgress: number;
        completed: number;
        overdue: number;
        completedThisWeek: number;
        monthlyData: {
            month: string;
            count: number;
        }[];
        statusDist: (import(".prisma/client").Prisma.PickEnumerable<import(".prisma/client").Prisma.TaskGroupByOutputType, "status"[]> & {
            _count: {
                id: number;
            };
        })[];
        recentTasks: ({
            category: {
                id: number;
                name: string;
                nameAr: string;
                color: string;
                icon: string;
            } | null;
            assignedTo: {
                fullName: string;
                fullNameAr: string;
                profilePhoto: string | null;
            };
        } & {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            description: string | null;
            title: string;
            titleAr: string | null;
            taskCode: string;
            categoryId: number | null;
            priority: string;
            assignedToId: number;
            createdById: number;
            startDate: Date | null;
            dueDate: Date | null;
            completedDate: Date | null;
            progressPercent: number;
        })[];
    }>;
    delete(id: number): Promise<{
        message: string;
    }>;
};
//# sourceMappingURL=task.service.d.ts.map