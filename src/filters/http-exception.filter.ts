import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
// ถ้าใช้ Prisma (มีในโปรเจกต์อยู่แล้ว)
import { Prisma } from '@prisma/client';

@Catch() // จับทุกอย่าง ไม่เฉพาะ HttpException
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();

    // ค่าเริ่มต้น
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorName = 'InternalServerError';
    let message: any = 'Unexpected error';

    // 1) กรณีเป็น HttpException ตามปกติ
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse() as any;
      errorName = (payload && payload.error) || exception.name;
      message = (payload && payload.message) || payload || exception.message;
    }
    // 2) จัดการ Prisma Error ที่พบบ่อย
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // ตัวอย่าง: unique violation
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        errorName = 'UniqueConstraintViolation';
        message = `Duplicate value for: ${(exception.meta?.target as string[])?.join(', ') || 'unique field'}`;
      } else {
        status = HttpStatus.BAD_REQUEST;
        errorName = 'PrismaClientKnownRequestError';
        message = exception.message;
      }
    }
    // 3) fallback: Error ปกติ
    else if (exception instanceof Error) {
      errorName = exception.name;
      message = exception.message || message;
    }

    res.status(status).json({
      statusCode: status,
      error: errorName,
      message,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
