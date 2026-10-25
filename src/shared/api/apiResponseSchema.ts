import { z } from 'zod';

export function apiResponseSchema<T>(messageSchema: z.ZodType<T>): z.ZodType<T> {
  return z
    .object({
      success: z.boolean(),
      msg: messageSchema.nullable(),
      errorCode: z.string().nullish(),
      errorMsg: z.string().nullish(),
    })
    .transform((response, context): T => {
      if (!response.success || response.msg === null) {
        context.addIssue({
          code: 'custom',
          message: response.errorMsg || '接口未返回业务数据',
        });
        return z.NEVER;
      }
      return response.msg;
    });
}
