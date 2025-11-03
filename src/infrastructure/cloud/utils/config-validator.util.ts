import { ConfigService } from '@nestjs/config';

/**
 * Utilidades para validación de configuración de cloud providers
 *
 * Este archivo contiene funciones reutilizables para validar variables de entorno
 * de diferentes providers de cloud (AWS, GCP, Azure, etc.).
 *
 * Todas estas funciones son puras y fáciles de testear.
 */

/**
 * Valida que las variables de entorno requeridas estén presentes
 *
 * Esta función es el corazón de la validación de configuración para todos
 * los providers. Lee múltiples variables de entorno y valida que todas
 * estén presentes antes de continuar.
 *
 * Proceso:
 * 1. Itera sobre todas las variables requeridas
 * 2. Intenta leer cada variable desde ConfigService
 * 3. Si alguna falta, la agrega a la lista de faltantes
 * 4. Si alguna falta, lanza error con todas las faltantes
 * 5. Si todas están presentes, retorna un Record con los valores
 *
 * @param configService - Servicio de configuración de NestJS
 * @param requiredVars - Array de nombres de variables requeridas
 * @param providerName - Nombre del provider para el mensaje de error (opcional)
 * @returns Record<string, string> con los valores de las variables validadas
 * @throws Error si alguna variable está faltante
 *
 * @example
 * const envVars = validateRequiredEnvVars(
 *   configService,
 *   ['AWS_REGION', 'AWS_QUEUE_URL'],
 *   'AWS'
 * );
 * // Retorna: { AWS_REGION: 'us-east-1', AWS_QUEUE_URL: 'https://...' }
 * // O lanza: Error: Variables de entorno requeridas faltantes para AWS: AWS_REGION
 */
export function validateRequiredEnvVars(
  configService: ConfigService,
  requiredVars: string[],
  providerName?: string,
): Record<string, string> {
  const values: Record<string, string> = {};
  const missing: string[] = [];

  // Paso 1 y 2: Iterar y leer cada variable
  for (const varName of requiredVars) {
    const value = configService.get<string>(varName);
    if (!value) {
      // Paso 3: Agregar a lista de faltantes
      missing.push(varName);
    } else {
      // Variable presente, guardar su valor
      values[varName] = value;
    }
  }

  // Paso 4: Si hay variables faltantes, lanzar error
  if (missing.length > 0) {
    const provider = providerName ? ` para ${providerName}` : '';
    throw new Error(
      `Variables de entorno requeridas faltantes${provider}: ${missing.join(', ')}`,
    );
  }

  // Paso 5: Retornar valores validados
  return values;
}

/**
 * Obtiene una variable de entorno opcional con valor por defecto
 *
 * Útil para variables de entorno que no son estrictamente requeridas
 * pero que necesitan un valor por defecto si no están definidas.
 *
 * Usa el operador ?? (nullish coalescing) para retornar el default
 * solo si el valor es null o undefined (no retorna default para string vacío).
 *
 * @param configService - Servicio de configuración de NestJS
 * @param varName - Nombre de la variable de entorno
 * @param defaultValue - Valor por defecto si la variable no existe
 * @returns El valor de la variable o el valor por defecto (puede ser undefined)
 *
 * @example
 * const eventBusName = getOptionalEnvVar(
 *   configService,
 *   'AWS_EVENTBUS_NAME',
 *   'default'
 * );
 * // Retorna: 'my-bus' si está definida, o 'default' si no está definida
 */
export function getOptionalEnvVar(
  configService: ConfigService,
  varName: string,
  defaultValue?: string,
): string | undefined {
  return configService.get<string>(varName) ?? defaultValue;
}

/**
 * Valida que una cadena sea una URL válida
 *
 * Usa el constructor URL de JavaScript para validar el formato.
 * Si el constructor lanza error, la URL es inválida.
 *
 * Útil para validar URLs de colas SQS, endpoints de APIs, etc.
 *
 * @param url - Cadena a validar como URL
 * @param varName - Nombre de la variable (para mensaje de error más claro)
 * @throws Error si la URL no es válida (formato incorrecto)
 *
 * @example
 * validateUrl(
 *   'https://sqs.us-east-1.amazonaws.com/123/queue',
 *   'AWS_QUEUE_URL'
 * );
 * // No lanza error si es válida
 *
 * validateUrl('invalid-url', 'AWS_QUEUE_URL');
 * // Lanza: Error: AWS_QUEUE_URL debe ser una URL válida. Valor recibido: invalid-url
 */
export function validateUrl(url: string, varName: string): void {
  try {
    // Intentar crear objeto URL
    // Si falla, el formato es inválido
    new URL(url);
  } catch {
    // Lanzar error descriptivo
    throw new Error(
      `${varName} debe ser una URL válida. Valor recibido: ${url}`,
    );
  }
}
