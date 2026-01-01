# How to Contribute

Thank you for your interest in contributing to Xians.ai! This guide will help you get started.

## Ways to Contribute

There are many ways to contribute to Xians.ai:

- 📝 **Documentation** - Improve or add documentation
- 🐛 **Bug Reports** - Report issues you encounter
- ✨ **Feature Requests** - Suggest new features
- 💻 **Code Contributions** - Submit bug fixes or new features
- 🧪 **Testing** - Help test new features and releases
- 💬 **Community Support** - Help others in discussions

## Getting Started

### 1. Fork the Repository

Fork the repository on GitHub and clone your fork:

```bash
git clone https://github.com/YOUR_USERNAME/XiansAi.Docs.git
cd XiansAi.Docs
```

### 2. Set Up Development Environment

Create a virtual environment and install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Create a Branch

Create a new branch for your contribution:

```bash
git checkout -b feature/your-feature-name
```

## Documentation Contributions

### Writing Documentation

1. **Follow the style guide** - Use clear, concise language
2. **Include examples** - Code examples help users understand
3. **Test your changes** - Run `mkdocs serve` to preview locally
4. **Check for errors** - Run `mkdocs build --strict`

### Documentation Structure

```
docs/
├── getting-started/    # Installation and quick start guides
├── user-guide/         # User documentation
├── api-reference/      # API documentation
└── contributing/       # Contribution guidelines
```

### Style Guide

- Use **bold** for UI elements and important terms
- Use `code formatting` for code, commands, and file names
- Use > blockquotes for important notes
- Include code examples where applicable

Example:

```markdown
## Section Title

Brief description of the section.

### Subsection

Detailed explanation with an example:

\`\`\`python
from xians import Agent

agent = Agent(name="MyAgent")
\`\`\`

!!! tip
    This is a helpful tip for users.
```

## Code Contributions

### Code Standards

- Follow PEP 8 for Python code
- Write clear, descriptive commit messages
- Add tests for new features
- Update documentation for API changes

### Testing

Run tests before submitting:

```bash
pytest
```

### Commit Messages

Use clear commit messages following this format:

```
<type>: <subject>

<body>

<footer>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test updates
- `chore`: Build/tooling changes

Example:

```
docs: Add API reference for Agent class

- Add detailed API documentation
- Include usage examples
- Add parameter descriptions

Closes #123
```

## Pull Request Process

### 1. Push Your Changes

```bash
git add .
git commit -m "docs: improve installation guide"
git push origin feature/your-feature-name
```

### 2. Create Pull Request

1. Go to the original repository on GitHub
2. Click "New Pull Request"
3. Select your branch
4. Fill in the PR template

### 3. PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Breaking change

## Checklist
- [ ] Tests pass locally
- [ ] Documentation updated
- [ ] No new warnings
- [ ] Follows code style

## Related Issues
Closes #123
```

### 4. Review Process

- Maintainers will review your PR
- Address any requested changes
- Once approved, your PR will be merged

## Community Guidelines

### Code of Conduct

We expect all contributors to:

- Be respectful and inclusive
- Welcome newcomers
- Focus on what's best for the community
- Show empathy towards others

### Getting Help

Need help? Here's where to ask:

- **[Discord Community](https://discord.gg/xians)** - General questions
- **[GitHub Discussions](https://github.com/XiansAiPlatform/discussions)** - Technical discussions
- **[GitHub Issues](https://github.com/XiansAiPlatform/issues)** - Bug reports

## Recognition

Contributors are recognized in:

- The project's README
- Release notes
- Annual contributor list

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT License).

## Questions?

If you have questions about contributing, please:

1. Check existing documentation
2. Search GitHub Issues
3. Ask in Discord
4. Open a new Discussion

Thank you for contributing to Xians.ai! 🎉


