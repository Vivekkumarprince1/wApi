import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { ValidationError } from '../utils/errors';

/**
 * Middleware to validate request data based on express-validator chains
 */
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    // Pass errors to the global error handler
    const formattedErrors = errors.array().map(err => ({
      field: (err as any).path,
      message: err.msg
    }));

    next(new ValidationError('Input validation failed', formattedErrors));
  };
};
