import { InvokeToolService, mapGitCommitFilesResult } from './invoke-tool.service';
import { GetCommitInputDto } from '../../core/invocations/dto/get-commit-input.dto';

describe('GetCommitInputDto', () => {
  it('accepts existing commit-mode input', () => {
    const result = GetCommitInputDto.schema().safeParse({
      repository: 'https://github.com/org/repo.git',
      commitId: 'abc123',
    });

    expect(result.success).toBe(true);
  });

  it('accepts full-mode input with branch', () => {
    const result = GetCommitInputDto.schema().safeParse({
      repository: 'https://github.com/org/repo.git',
      commitId: 'abc123',
      scanMode: 'full',
      branch: 'main',
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid scanMode values', () => {
    const result = GetCommitInputDto.schema().safeParse({
      repository: 'https://github.com/org/repo.git',
      commitId: 'abc123',
      scanMode: 'invalid',
    });

    expect(result.success).toBe(false);
  });
});

describe('mapGitCommitFilesResult', () => {
  it('maps snake_case worker metadata to camelCase poll output', () => {
    expect(
      mapGitCommitFilesResult({
        commit_id: 'abc123',
        files_paths: ['full/job-1/src/app.ts'],
        scan_mode: 'full',
        scan_ref: 'main',
        storage_prefix: 'full/job-1',
      }),
    ).toEqual({
      commitId: 'abc123',
      filesPaths: ['full/job-1/src/app.ts'],
      scanMode: 'full',
      scanRef: 'main',
      storagePrefix: 'full/job-1',
    });
  });
});

describe('InvokeToolService', () => {
  const context = {
    mcpRequest: { params: { name: 'mcp.tool.git.commit-files' } },
    reportProgress: jest.fn(),
  } as any;

  function createService() {
    return new InvokeToolService(
      { publish: jest.fn().mockResolvedValue({ jobId: 'job-1' }) } as any,
      { saveJob: jest.fn() } as any,
      { saveContext: jest.fn() } as any,
    );
  }

  it('rejects full-mode invocation without branch before publishing', async () => {
    const service = createService();

    await expect(
      service.toolGitCommitFiles(
        {
          repository: 'https://github.com/org/repo.git',
          commitId: 'abc123',
          scanMode: 'full',
        } as GetCommitInputDto,
        context,
      ),
    ).rejects.toThrow('branch is required when scanMode is full');
  });
});
