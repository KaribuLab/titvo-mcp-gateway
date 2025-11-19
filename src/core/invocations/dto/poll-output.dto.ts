import { SchemaDto } from '../../../shared/dto/schema.dto';
import { StringField } from '../../../shared/dto/decorators/field.decorator';
import { JobStatus } from './job-status.enum';

/**
 * PollOutputDto - DTO base para outputs de tools de polling
 *
 * Clase base que contiene los campos comunes que todos los DTOs de polling deben tener:
 * - jobId: ID del job que se está consultando
 * - status: Estado actual del job (REQUESTED, IN_PROGRESS, SUCCESS, FAILURE)
 *
 * Características:
 * - Extiende SchemaDto para generación automática de schema Zod
 * - Proporciona campos base para todos los DTOs de polling
 * - Evita duplicación de código en DTOs específicos
 *
 * Los DTOs específicos deben extender esta clase y agregar sus campos adicionales.
 *
 * @example
 * export class MyPollOutputDto extends PollOutputDto {
 *   @StringField({ description: 'My specific field' })
 *   myField: string;
 * }
 */
export abstract class PollOutputDto extends SchemaDto {
  /** ID del job que se está consultando */
  @StringField({ description: 'The ID of the job that was invoked' })
  jobId: string;

  /** Estado del job: "REQUESTED" | "IN_PROGRESS" | "SUCCESS" | "FAILURE". Si es "REQUESTED" o "IN_PROGRESS", el job aún está procesándose y debes llamar esta tool nuevamente más tarde. Si es "SUCCESS", el job terminó y los campos específicos estarán disponibles. Si es "FAILURE", el job falló. */
  @StringField({
    description:
      `Status of the job: ${JobStatus.REQUESTED} | ${JobStatus.IN_PROGRESS} | ${JobStatus.SUCCESS} | ${JobStatus.FAILURE}. If status is ${JobStatus.REQUESTED} or ${JobStatus.IN_PROGRESS}, the job is still processing and you must call this tool again later. If status is ${JobStatus.SUCCESS}, the job completed and specific fields will be available. If status is ${JobStatus.FAILURE}, the job failed.`,
  })
  status: JobStatus;
}

