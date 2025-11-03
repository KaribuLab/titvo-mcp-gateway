import 'reflect-metadata';
import z from 'zod';
import {
  FIELD_TYPE,
  FIELD_OPTIONS,
  FIELDS_LIST,
  StringFieldOptions,
  NumberFieldOptions,
  BooleanFieldOptions,
  EnumFieldOptions,
  ArrayFieldOptions,
  ObjectFieldOptions,
} from '../dto/decorators/field.decorator';

/**
 * SchemaDto - Clase base para DTOs con schema Zod generado automáticamente
 *
 * Los DTOs que extiendan esta clase deben usar decoradores de campo
 * (@StringField, @NumberField, etc.) en sus propiedades.
 *
 * El método schema() lee los decoradores y construye el schema Zod automáticamente.
 *
 * @example
 * export class UserDto extends SchemaDto {
 *   @StringField({ description: 'User name', minLength: 3 })
 *   name: string;
 *
 *   @NumberField({ description: 'User age', min: 0 })
 *   age: number;
 * }
 *
 * // Uso:
 * const schema = UserDto.schema();
 * const result = schema.parse({ name: 'John', age: 30 });
 */
export abstract class SchemaDto {
  /**
   * Genera el schema Zod automáticamente a partir de los decoradores de campo
   *
   * @returns Schema Zod para validar instancias de este DTO
   */
  static schema(): z.ZodObject<any> {
    // Obtener la lista de campos decorados
    const fields: string[] =
      Reflect.getMetadata(FIELDS_LIST, this.prototype) || [];

    if (fields.length === 0) {
      throw new Error(
        `${this.name}: No fields decorated. Use @StringField, @NumberField, etc. on properties.`,
      );
    }

    // Construir el shape del schema
    const schemaShape: Record<string, z.ZodType> = {};

    for (const fieldName of fields) {
      const fieldType: string = Reflect.getMetadata(
        FIELD_TYPE,
        this.prototype,
        fieldName,
      );
      const fieldOptions: any = Reflect.getMetadata(
        FIELD_OPTIONS,
        this.prototype,
        fieldName,
      );

      if (!fieldType || !fieldOptions) {
        throw new Error(
          `${this.name}.${fieldName}: Missing field metadata. Ensure decorator is applied correctly.`,
        );
      }

      // Construir el schema para este campo
      schemaShape[fieldName] = this.buildFieldSchema(fieldType, fieldOptions);
    }

    return z.object(schemaShape);
  }

  /**
   * Construye el schema Zod para un campo individual
   *
   * @param type - Tipo del campo ('string', 'number', etc.)
   * @param options - Opciones del decorador
   * @returns Schema Zod para el campo
   */
  private static buildFieldSchema(type: string, options: any): z.ZodType {
    switch (type) {
      case 'string':
        return this.buildStringSchema(options as StringFieldOptions);

      case 'number':
        return this.buildNumberSchema(options as NumberFieldOptions);

      case 'boolean':
        return this.buildBooleanSchema(options as BooleanFieldOptions);

      case 'enum':
        return this.buildEnumSchema(options as EnumFieldOptions);

      case 'array':
        return this.buildArraySchema(options as ArrayFieldOptions);

      case 'object':
        return this.buildObjectSchema(options as ObjectFieldOptions);

      default:
        throw new Error(`Unsupported field type: ${type}`);
    }
  }

  /**
   * Construye schema Zod para campo String
   */
  private static buildStringSchema(options: StringFieldOptions): z.ZodType {
    let schema = z.string().describe(options.description);

    // Aplicar validaciones
    if (options.required !== false) {
      schema = schema.min(1, `${options.description} is required`);
    }

    if (options.minLength !== undefined) {
      schema = schema.min(
        options.minLength,
        `Minimum length is ${options.minLength}`,
      );
    }

    if (options.maxLength !== undefined) {
      schema = schema.max(
        options.maxLength,
        `Maximum length is ${options.maxLength}`,
      );
    }

    if (options.pattern) {
      schema = schema.regex(options.pattern, 'Invalid format');
    }

    // Si no es requerido, hacerlo opcional
    if (options.required === false) {
      return schema.optional();
    }

    return schema;
  }

  /**
   * Construye schema Zod para campo Number
   */
  private static buildNumberSchema(options: NumberFieldOptions): z.ZodType {
    let schema = z.number().describe(options.description);

    // Si debe ser entero
    if (options.int) {
      schema = schema.int('Must be an integer');
    }

    // Aplicar validaciones
    if (options.min !== undefined) {
      schema = schema.min(options.min, `Minimum value is ${options.min}`);
    }

    if (options.max !== undefined) {
      schema = schema.max(options.max, `Maximum value is ${options.max}`);
    }

    // Si no es requerido, hacerlo opcional
    if (options.required === false) {
      return schema.optional();
    }

    return schema;
  }

  /**
   * Construye schema Zod para campo Boolean
   */
  private static buildBooleanSchema(options: BooleanFieldOptions): z.ZodType {
    const schema = z.boolean().describe(options.description);

    // Si no es requerido, hacerlo opcional
    if (options.required === false) {
      return schema.optional();
    }

    return schema;
  }

  /**
   * Construye schema Zod para campo Enum
   */
  private static buildEnumSchema(options: EnumFieldOptions): z.ZodType {
    const schema = z.nativeEnum(options.enum).describe(options.description);

    // Si no es requerido, hacerlo opcional
    if (options.required === false) {
      return schema.optional();
    }

    return schema;
  }

  /**
   * Construye schema Zod para campo Array
   */
  private static buildArraySchema(options: ArrayFieldOptions): z.ZodType {
    // El itemType debe ser una clase que también extiende SchemaDto
    if (!options.itemType || typeof options.itemType.schema !== 'function') {
      throw new Error(
        `ArrayField itemType must be a class extending SchemaDto with a schema() method`,
      );
    }

    const itemSchema = options.itemType.schema();
    let schema = z.array(itemSchema).describe(options.description);

    // Aplicar validaciones
    if (options.minItems !== undefined) {
      schema = schema.min(
        options.minItems,
        `Minimum ${options.minItems} items required`,
      );
    }

    if (options.maxItems !== undefined) {
      schema = schema.max(
        options.maxItems,
        `Maximum ${options.maxItems} items allowed`,
      );
    }

    // Si no es requerido, hacerlo opcional
    if (options.required === false) {
      return schema.optional();
    }

    return schema;
  }

  /**
   * Construye schema Zod para campo Object (DTO anidado)
   */
  private static buildObjectSchema(options: ObjectFieldOptions): z.ZodType {
    // El type debe ser una clase que también extiende SchemaDto
    if (!options.type || typeof options.type.schema !== 'function') {
      throw new Error(
        `ObjectField type must be a class extending SchemaDto with a schema() method`,
      );
    }

    const schema = options.type.schema().describe(options.description);

    // Si no es requerido, hacerlo opcional
    if (options.required === false) {
      return schema.optional();
    }

    return schema;
  }
}
