import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';
import prisma from '../prisma/client';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    roleId: number;
    roleName: string;
    roleLevel: number;
  };
}

export async function authenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401);
    }

    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });

    if (!user || !user.isActive) {
      throw new AppError('User not found or inactive', 401);
    }

    req.user = {
      id: user.id,
      username: user.username,
      roleId: user.roleId,
      roleName: user.role.name,
      roleLevel: user.role.level,
    };
    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      next(new AppError('Invalid or expired token', 401));
    } else {
      next(error);
    }
  }
}

// Role-based authorization
export function authorize(...allowedRoles: string[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Unauthorized', 401));
    if (!allowedRoles.includes(req.user.roleName)) {
      return next(new AppError('Forbidden: insufficient permissions', 403));
    }
    next();
  };
}

// Level-based authorization (e.g., level <= 3 means SUPERADMIN, ADMIN, MANAGER)
export function authorizeLevel(maxLevel: number) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Unauthorized', 401));
    if (req.user.roleLevel > maxLevel) {
      return next(new AppError('Forbidden: insufficient permissions', 403));
    }
    next();
  };
}
