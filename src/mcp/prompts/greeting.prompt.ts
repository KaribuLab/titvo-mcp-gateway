import { Injectable, Scope } from '@nestjs/common';
import { Prompt } from '@rekog/mcp-nest';
import { z } from 'zod';

/**
 * GreetingPrompt - Prompt MCP de ejemplo para saludos multilingües
 *
 * Este prompt genera instrucciones para que un LLM salude a usuarios
 * en su idioma nativo.
 *
 * Características:
 * - Scope REQUEST para aislamiento por petición
 * - Parámetros validados con Zod schema
 * - Retorna mensaje formateado para el LLM
 *
 * Uso:
 * Este es un ejemplo demostrativo de cómo crear prompts MCP.
 * Puede ser útil para generar prompts dinámicos basados en contexto.
 *
 * @example
 * // Cliente MCP invoca el prompt:
 * // mcp://multilingual-greeting-guide?name=John&language=Spanish
 * // Retorna prompt para que LLM salude a John en español
 */
@Injectable({ scope: Scope.REQUEST })
export class GreetingPrompt {
  constructor() {}

  /**
   * Genera instrucciones para saludar a un usuario en su idioma
   *
   * @param name - Nombre de la persona a saludar
   * @param language - Idioma en el que saludar
   * @returns Prompt formateado para el LLM
   */
  @Prompt({
    name: 'multilingual-greeting-guide',
    description:
      'Simple instruction for greeting users in their native languages',
    parameters: z.object({
      name: z.string().describe('The name of the person to greet'),
      language: z.string().describe('The language to use for the greeting'),
    }),
  })
  getGreetingInstructions({ name, language }) {
    const result = {
      description: 'Greet users in their native languages!',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Greet ${name} in their preferred language: ${language}`,
          },
        },
      ],
    };
    return result;
  }
}
