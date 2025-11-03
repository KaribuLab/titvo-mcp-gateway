import 'reflect-metadata';

/**
 * field.decorator.ts - Decoradores para definir campos de DTOs con schemas Zod automáticos
 *
 * Este archivo proporciona decoradores de propiedades que almacenan metadata
 * sobre los campos de un DTO. Esta metadata es luída por SchemaDto.schema()
 * para generar automáticamente schemas Zod de validación.
 *
 * Decoradores disponibles:
 * - @StringField: Campos de texto (con validaciones de longitud, pattern)
 * - @NumberField: Campos numéricos (con min, max, int)
 * - @BooleanField: Campos booleanos
 * - @EnumField: Campos de enum
 * - @ArrayField: Arrays de items (con validaciones de longitud)
 * - @ObjectField: Objetos anidados (DTOs anidados)
 *
 * Características:
 * - Usa reflect-metadata para almacenar información de campos
 * - Genera schemas Zod automáticamente
 * - Reduce código boilerplate en DTOs
 * - Mantiene la validación sincronizada con la definición
 *
 * @example
 * export class UserDto extends SchemaDto {
 *   @StringField({ description: 'User name', minLength: 3 })
 *   name: string;
 *
 *   @NumberField({ description: 'User age', min: 0, max: 150 })
 *   age: number;
 *
 *   @BooleanField({ description: 'Is active' })
 *   isActive: boolean;
 * }
 *
 * // Schema generado automáticamente:
 * const schema = UserDto.schema();
 * // z.object({ name: z.string().min(3), age: z.number().min(0).max(150), ... })
 */

/**
 * Símbolos para las claves de metadata
 * Usar Symbols evita colisiones de nombres
 */
export const FIELD_TYPE = Symbol('fieldType');
export const FIELD_OPTIONS = Symbol('fieldOptions');
export const FIELDS_LIST = Symbol('fieldsList');

/**
 * Opciones para campos de tipo String
 */
export interface StringFieldOptions {
  /** Descripción del campo para documentación y mensajes de error */
  description: string;
  /** Si el campo es requerido (default: true) */
  required?: boolean;
  /** Longitud mínima de la cadena */
  minLength?: number;
  /** Longitud máxima de la cadena */
  maxLength?: number;
  /** Pattern RegExp que debe cumplir la cadena */
  pattern?: RegExp;
}

/**
 * Opciones para campos de tipo Number
 */
export interface NumberFieldOptions {
  /** Descripción del campo para documentación y mensajes de error */
  description: string;
  /** Si el campo es requerido (default: true) */
  required?: boolean;
  /** Valor mínimo permitido */
  min?: number;
  /** Valor máximo permitido */
  max?: number;
  /** Si debe ser un número entero */
  int?: boolean;
}

/**
 * Opciones para campos de tipo Boolean
 */
export interface BooleanFieldOptions {
  /** Descripción del campo para documentación y mensajes de error */
  description: string;
  /** Si el campo es requerido (default: true) */
  required?: boolean;
}

/**
 * Opciones para campos de tipo Enum
 */
export interface EnumFieldOptions {
  /** Descripción del campo para documentación y mensajes de error */
  description: string;
  /** El enum nativo de TypeScript a usar */
  enum: any;
  /** Si el campo es requerido (default: true) */
  required?: boolean;
}

/**
 * Opciones para campos de tipo Array
 */
export interface ArrayFieldOptions {
  /** Descripción del campo para documentación y mensajes de error */
  description: string;
  /** Clase del DTO de los items del array (debe extender SchemaDto) */
  itemType: any;
  /** Si el campo es requerido (default: true) */
  required?: boolean;
  /** Número mínimo de items en el array */
  minItems?: number;
  /** Número máximo de items en el array */
  maxItems?: number;
}

/**
 * Opciones para campos de tipo Object
 */
export interface ObjectFieldOptions {
  /** Descripción del campo para documentación y mensajes de error */
  description: string;
  /** Clase del DTO anidado (debe extender SchemaDto) */
  type: any;
  /** Si el campo es requerido (default: true) */
  required?: boolean;
}

/**
 * Decorador para campos de tipo String
 *
 * Almacena metadata sobre el campo que será usada por SchemaDto.schema()
 * para generar un schema Zod z.string() con las validaciones especificadas.
 *
 * @param options - Opciones de validación para el campo string
 * @returns Decorador de propiedad
 *
 * @example
 * @StringField({ description: 'User name', minLength: 3, maxLength: 50 })
 * name: string;
 *
 * @StringField({ description: 'Email', pattern: /^[^@]+@[^@]+$/ })
 * email: string;
 */
export function StringField(options: StringFieldOptions) {
  return function (target: object, propertyKey: string) {
    // Guardar tipo de campo
    Reflect.defineMetadata(FIELD_TYPE, 'string', target, propertyKey);

    // Guardar opciones
    Reflect.defineMetadata(FIELD_OPTIONS, options, target, propertyKey);

    // Registrar este campo en la lista de campos de la clase
    const existingFields =
      (Reflect.getMetadata(FIELDS_LIST, target) as string[]) || [];
    if (!existingFields.includes(propertyKey)) {
      Reflect.defineMetadata(
        FIELDS_LIST,
        [...existingFields, propertyKey],
        target,
      );
    }
  };
}

/**
 * Decorador para campos de tipo Number
 *
 * @example
 * @NumberField({ description: 'User age', min: 0, max: 150 })
 * age: number;
 */
export function NumberField(options: NumberFieldOptions) {
  return function (target: object, propertyKey: string) {
    Reflect.defineMetadata(FIELD_TYPE, 'number', target, propertyKey);
    Reflect.defineMetadata(FIELD_OPTIONS, options, target, propertyKey);

    const existingFields =
      (Reflect.getMetadata(FIELDS_LIST, target) as string[]) || [];
    if (!existingFields.includes(propertyKey)) {
      Reflect.defineMetadata(
        FIELDS_LIST,
        [...existingFields, propertyKey],
        target,
      );
    }
  };
}

/**
 * Decorador para campos de tipo Boolean
 *
 * @example
 * @BooleanField({ description: 'Is active' })
 * isActive: boolean;
 */
export function BooleanField(options: BooleanFieldOptions) {
  return function (target: object, propertyKey: string) {
    Reflect.defineMetadata(FIELD_TYPE, 'boolean', target, propertyKey);
    Reflect.defineMetadata(FIELD_OPTIONS, options, target, propertyKey);

    const existingFields =
      (Reflect.getMetadata(FIELDS_LIST, target) as string[]) || [];
    if (!existingFields.includes(propertyKey)) {
      Reflect.defineMetadata(
        FIELDS_LIST,
        [...existingFields, propertyKey],
        target,
      );
    }
  };
}

/**
 * Decorador para campos de tipo Enum
 *
 * @example
 * @EnumField({ description: 'User role', enum: UserRole })
 * role: UserRole;
 */
export function EnumField(options: EnumFieldOptions) {
  return function (target: object, propertyKey: string) {
    Reflect.defineMetadata(FIELD_TYPE, 'enum', target, propertyKey);
    Reflect.defineMetadata(FIELD_OPTIONS, options, target, propertyKey);

    const existingFields =
      (Reflect.getMetadata(FIELDS_LIST, target) as string[]) || [];
    if (!existingFields.includes(propertyKey)) {
      Reflect.defineMetadata(
        FIELDS_LIST,
        [...existingFields, propertyKey],
        target,
      );
    }
  };
}

/**
 * Decorador para campos de tipo Array
 *
 * @example
 * @ArrayField({ description: 'User tags', itemType: TagDto, minItems: 1 })
 * tags: TagDto[];
 */
export function ArrayField(options: ArrayFieldOptions) {
  return function (target: object, propertyKey: string) {
    Reflect.defineMetadata(FIELD_TYPE, 'array', target, propertyKey);
    Reflect.defineMetadata(FIELD_OPTIONS, options, target, propertyKey);

    const existingFields =
      (Reflect.getMetadata(FIELDS_LIST, target) as string[]) || [];
    if (!existingFields.includes(propertyKey)) {
      Reflect.defineMetadata(
        FIELDS_LIST,
        [...existingFields, propertyKey],
        target,
      );
    }
  };
}

/**
 * Decorador para campos de tipo Object (DTO anidado)
 *
 * @example
 * @ObjectField({ description: 'User address', type: AddressDto })
 * address: AddressDto;
 */
export function ObjectField(options: ObjectFieldOptions) {
  return function (target: object, propertyKey: string) {
    Reflect.defineMetadata(FIELD_TYPE, 'object', target, propertyKey);
    Reflect.defineMetadata(FIELD_OPTIONS, options, target, propertyKey);

    const existingFields =
      (Reflect.getMetadata(FIELDS_LIST, target) as string[]) || [];
    if (!existingFields.includes(propertyKey)) {
      Reflect.defineMetadata(
        FIELDS_LIST,
        [...existingFields, propertyKey],
        target,
      );
    }
  };
}
