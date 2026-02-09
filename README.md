# Xians.ai Documentation

Official documentation for the Xians.ai platform - An enterprise-grade Agent Development Kit for building, deploying, and orchestrating AI agents.

## 🌐 Live Documentation

[https://xiansaiplatform.github.io/XiansAi.Docs/](https://xiansaiplatform.github.io/XiansAi.Docs/)

## 📚 About

This repository contains the source files for the Xians.ai documentation website, built with [MkDocs](https://www.mkdocs.org/) and [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/).

## 🚀 Quick Start

### Prerequisites

- **Python 3.9+** - [Download Python](https://www.python.org/downloads/)
- **Git** - [Download Git](https://git-scm.com/downloads)

### Local Development Setup

1. **Clone the repository**

```bash
git clone https://github.com/XiansAiPlatform/XiansAi.Docs.git
cd XiansAi.Docs
```

2. **Create and activate a Python virtual environment**

**macOS/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

**Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

3. **Install dependencies**

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

4. **Run the development server**

```bash
mkdocs serve

```

The documentation will be available at [http://127.0.0.1:8000](http://127.0.0.1:8000)

The development server automatically reloads when you save changes to your documentation files.

## 📝 Writing Documentation

### File Organization

```
docs/
├── index.md                    # Homepage
├── getting-started/           # Getting started guides
├── user-guide/               # User documentation
├── api-reference/            # API documentation
├── contributing/             # Contribution guidelines
├── assets/                   # Images, logos
├── images/                   # Documentation images
├── stylesheets/              # Custom CSS
├── javascripts/              # Custom JavaScript
└── includes/                 # Reusable content snippets
```

### Adding New Pages

1. Create a new Markdown file in the appropriate directory
2. Add the page to the navigation in `mkdocs.yml`:

```yaml
nav:
  - Home: index.md
  - Your New Section:
    - Page Title: path/to/your-page.md
```

### Markdown Features

This documentation supports a wide range of Markdown features:

- **Admonitions** - Note, tip, warning, danger blocks
- **Code blocks** - With syntax highlighting and line numbers
- **Tabs** - Tabbed content blocks
- **Tables** - Markdown tables
- **Math** - Mathematical equations with MathJax
- **Diagrams** - Mermaid diagrams
- **Icons & Emojis** - Material icons and emoji support
- **And more!**

See the [Material for MkDocs reference](https://squidfunk.github.io/mkdocs-material/reference/) for complete documentation.

### Code Block Example

````markdown
```python
def hello_world():
    print("Hello, Xians.ai!")
```
````

### Admonition Example

```markdown
!!! note "Important Information"
    This is a note admonition with important information.

!!! tip
    This is a helpful tip.

!!! warning
    This is a warning message.
```

## 🏗️ Building the Documentation

To build the static site locally:

```bash
mkdocs build
```

The built site will be in the `site/` directory.

To build with strict mode (fail on warnings):

```bash
mkdocs build --strict
```

## 🚀 Deployment

### Automatic Deployment

Documentation is automatically deployed to GitHub Pages via GitHub Actions in the following scenarios:

- **Push to `main` branch** - Deploys the latest development version
- **Version tags** - Deploys versioned releases (e.g., `v1.0.0`, `v2.1.0`)

#### Deploying Regular Updates

Push changes to the main branch:
```bash
git add .
git commit -m "Update documentation"
git push origin main
```

#### Deploying

The workflow is defined in `.github/workflows/deploy.yml`.

### Manual Deployment

To manually deploy to GitHub Pages:

```bash
mkdocs gh-deploy --force --clean
```

## Releases

```bash
# Define the version
export VERSION=3.10.1 # or 1.3.7-beta for pre-release

# Create and push a version tag
git tag -a v$VERSION -m "Release v$VERSION"
git push origin v$VERSION
```

## 🤝 Contributing

We welcome contributions to improve the documentation!

### Contribution Workflow

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/improve-docs
   ```
3. **Make your changes**
4. **Test locally**
   ```bash
   mkdocs serve
   ```
5. **Commit your changes**
   ```bash
   git add .
   git commit -m "Improve documentation for X"
   ```
6. **Push to your fork**
   ```bash
   git push origin feature/improve-docs
   ```
7. **Create a Pull Request**

### Documentation Standards

- Use clear, concise language
- Include code examples where applicable
- Add screenshots for UI-related documentation
- Follow the existing structure and style
- Test all links and code examples
- Run `mkdocs build --strict` before submitting

## 📦 Dependencies

### Core Dependencies

- **mkdocs** (≥1.6.1) - Static site generator
- **mkdocs-material** (≥9.5.47) - Material theme
- **pymdown-extensions** (≥10.12) - Markdown extensions

### Plugins

- **mkdocs-minify-plugin** - Minifies HTML, CSS, and JS
- **mkdocs-git-revision-date-localized-plugin** - Shows last updated dates

See `requirements.txt` for the complete list.

## 🔧 Configuration

The main configuration file is `mkdocs.yml`. Key sections:

- **Site metadata** - Name, description, URL
- **Theme configuration** - Colors, fonts, features
- **Navigation structure** - Page organization
- **Markdown extensions** - Enabled features
- **Plugins** - Additional functionality

## 🐛 Troubleshooting

### Common Issues

**Issue: `mkdocs: command not found`**
- Solution: Ensure your virtual environment is activated and dependencies are installed

**Issue: Port 8000 already in use**
- Solution: Use a different port: `mkdocs serve --dev-addr=127.0.0.1:8001`

**Issue: Changes not appearing**
- Solution: Hard refresh your browser (Ctrl+F5 or Cmd+Shift+R)

**Issue: Build warnings**
- Solution: Run `mkdocs build --strict` to see detailed error messages

## 📧 Support

- **Documentation Issues**: [GitHub Issues](https://github.com/XiansAiPlatform/XiansAi.Docs/issues)
- **General Support**: [Discord Community](https://discord.gg/xians)
- **Website**: [xians.ai](https://xians.ai)

## 📄 License

This documentation is licensed under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Built with [MkDocs](https://www.mkdocs.org/)
- Theme by [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/)
- Hosted on [GitHub Pages](https://pages.github.com/)

---

**Made with ❤️ by the Xians.ai Team**
