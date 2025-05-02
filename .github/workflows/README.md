# GitHub Workflows

This directory contains GitHub Actions workflows for automating testing, linting, building, and publishing processes.

## Available Workflows

### 1. Tests (`test.yml`)

- Triggered on: Push to `main`, Pull Requests to `main`
- Actions:
  - Runs all tests with `npm test`
  - Generates coverage report with `npm run test:coverage`
  - Uploads coverage to Codecov (requires CODECOV_TOKEN secret)

### 2. Lint (`lint.yml`)

- Triggered on: Push to `main`, Pull Requests to `main`
- Actions:
  - Runs ESLint with `npm run lint`

### 3. Build (`build.yml`)

- Triggered on: Push to `main`, Pull Requests to `main`
- Actions:
  - Builds the package with `npm run build`
  - Verifies the examples work properly

### 4. Publish (`publish.yml`)

- Triggered on: New GitHub Release
- Actions:
  - Builds the package
  - Publishes to npm
  - Requires NPM_TOKEN secret to be set in repository settings

## Setting Up Required Secrets

To use these workflows fully, you need to set up the following secrets in your GitHub repository:

1. `NPM_TOKEN`: For publishing to npm
2. `CODECOV_TOKEN`: For uploading coverage reports to Codecov

### How to Add Secrets

1. Go to your GitHub repository
2. Click on "Settings"
3. Navigate to "Secrets and variables" > "Actions"
4. Click on "New repository secret"
5. Add the required secrets
