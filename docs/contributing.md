# Contributing Guide

## Getting Started

1. Fork the repository
2. Clone your fork:

```bash
git clone https://github.com/your-username/yt-dlp-mcp.git
cd yt-dlp-mcp
```

3. Install dependencies:

```bash
npm install
```

4. Create a new branch:

```bash
git checkout -b feature/your-feature-name
```

## Development Setup

### Prerequisites

- Node.js 16.x or higher
- yt-dlp installed on your system
- TypeScript knowledge
- Jest for testing

### Building

```bash
npm run prepare
```

### Running Tests

```bash
npm test
```

For specific test files:

```bash
npm test -- src/__tests__/video.test.ts
```

## Code Style

We use TypeScript and follow these conventions:

- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Follow the existing code style
- Use async/await for promises
- Handle errors appropriately

### TypeScript Guidelines

```typescript
// Use explicit types
function downloadVideo(url: string, config?: Config): Promise<string> {
  // Implementation
}

// Use interfaces for complex types
interface DownloadOptions {
  resolution: string;
  format: string;
  output: string;
}

// Use enums for fixed values
enum Resolution {
  SD = "480p",
  HD = "720p",
  FHD = "1080p",
  BEST = "best",
}
```

## Testing

### Writing Tests

- Place tests in `src/__tests__` directory
- Name test files with `.test.ts` suffix
- Use descriptive test names
- Test both success and error cases

Example:

```typescript
describe("downloadVideo", () => {
  test("downloads video successfully", async () => {
    const result = await downloadVideo(testUrl);
    expect(result).toMatch(/Video successfully downloaded/);
  });

  test("handles invalid URL", async () => {
    await expect(downloadVideo("invalid-url")).rejects.toThrow(
      "Invalid or unsupported URL"
    );
  });
});
```

### Test Coverage

Aim for high test coverage:

```bash
npm run test:coverage
```

## Documentation

### JSDoc Comments

Add comprehensive JSDoc comments for all public APIs:

````typescript
/**
 * Downloads a video from the specified URL.
 *
 * @param url - The URL of the video to download
 * @param config - Optional configuration object
 * @param resolution - Preferred video resolution
 * @returns Promise resolving to success message with file path
 * @throws {Error} When URL is invalid or download fails
 *
 * @example
 * ```typescript
 * const result = await downloadVideo('https://youtube.com/watch?v=...', config);
 * console.log(result);
 * ```
 */
export async function downloadVideo(
  url: string,
  config?: Config,
  resolution?: string
): Promise<string> {
  // Implementation
}
````

### README Updates

- Update README.md for new features
- Keep examples up to date
- Document breaking changes

## Pull Request Process

1. Update tests and documentation
2. Run all tests and linting
3. Update CHANGELOG.md
4. Create detailed PR description
5. Reference related issues

### PR Checklist

- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Code follows style guidelines
- [ ] All tests passing
- [ ] No linting errors

## Release Process

1. Update version in package.json
2. Update CHANGELOG.md
3. Create release commit
4. Tag release
5. Push to main branch

### Version Numbers

Follow semantic versioning:

- MAJOR: Breaking changes
- MINOR: New features
- PATCH: Bug fixes

## Community

- Be respectful and inclusive
- Help others when possible
- Report bugs with detailed information
- Suggest improvements
- Share success stories

For more information, see the [README](./README.md) and [API Reference](./api.md).
