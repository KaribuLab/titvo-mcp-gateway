import { plainToInstance, instanceToPlain } from 'class-transformer';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { AnnotationDto } from './annotation-input.dto';

const finding = {
  title: 'Legacy hashing', description: 'External API requires MD5',
  severity: 'LOW', path: 'src/api.ts', line: 1, summary: 'Legacy API',
  code: 'md5(payload)', recommendation: 'Replace the legacy API',
};
const acceptance = {
  reason: 'Legacy system cannot be modified', accepted_by: 'Security team',
  expires_on: '2030-12-31',
};

describe('AnnotationDto public acceptance contract', () => {
  it('preserves legacy annotations without acceptance', () => {
    expect(AnnotationDto.schema().parse(finding)).toEqual(finding);
    const transformed = instanceToPlain(plainToInstance(AnnotationDto, finding));
    expect(JSON.parse(JSON.stringify(transformed))).toEqual(finding);
  });

  it('preserves nested acceptance and every original finding field', () => {
    const input = { ...finding, acceptance };
    expect(AnnotationDto.schema().parse(input)).toEqual(input);
    expect(instanceToPlain(plainToInstance(AnnotationDto, input))).toEqual(input);
  });

  it.each(['reason', 'accepted_by', 'expires_on'])('requires nonempty string %s in present acceptance', (field) => {
    for (const value of [undefined, '', 42, null]) {
      const input = { ...finding, acceptance: { ...acceptance, [field]: value } };
      const snapshot = JSON.stringify(input);
      const result = AnnotationDto.schema().safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues[0].path).toEqual(['acceptance', field]);
      expect(JSON.stringify(input)).toBe(snapshot);
    }
  });

  it.each([null, 'accepted', []])('rejects a non-object acceptance: %p', (value) => {
    expect(AnnotationDto.schema().safeParse({ ...finding, acceptance: value }).success).toBe(false);
  });

  it('publishes optional acceptance with three required string fields in JSON Schema', () => {
    const schema = zodToJsonSchema(AnnotationDto.schema()) as any;
    expect(schema.required).not.toContain('acceptance');
    expect(schema.properties.acceptance.type).toBe('object');
    expect(schema.properties.acceptance.required).toEqual(['reason', 'accepted_by', 'expires_on']);
    for (const field of ['reason', 'accepted_by', 'expires_on']) {
      expect(schema.properties.acceptance.properties[field].type).toBe('string');
      expect(schema.properties.acceptance.properties[field].minLength).toBe(1);
    }
  });
});
