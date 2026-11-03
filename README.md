# UniAI

**UniAI** is short for **University AI**. It is an independent student learning companion concept, initially for the Nelson Mandela University (NMU) community. The first release is intended to help a small pilot group understand course material, practise concepts, and decide what to study next.

This is not an official NMU service. The product must clearly identify itself as independent unless a formal partnership is agreed. The name and use of university branding need review before public launch.

## Project starting point

- Product requirements: [docs/product-spec.md](docs/product-spec.md)
- Technical blueprint and build sequence: [docs/technical-blueprint.md](docs/technical-blueprint.md)
- Security and privacy baseline: [docs/security-baseline.md](docs/security-baseline.md)
- POPIA privacy plan: [docs/privacy-plan.md](docs/privacy-plan.md)

## First release

Start with a responsive web app for a small, invited pilot. Students select a module, add study material they have permission to use, ask for a grounded explanation, and complete a short practice quiz. Keep the first release independent of NMU accounts and internal systems.

## Run the foundation locally

1. From the repository root, run `dotnet run --project .\src\api\UniAi.Api.csproj`.
2. In a second terminal, change to `src/web`, run `npm install` once, then `npm run dev`.
3. Open the local address shown by Vite. The header reports whether the API health endpoint is reachable.
4. Copy `.env.example` to `.env.local` only if you need to change the API address. Do not put secrets in Vite environment variables; values prefixed with `VITE_` are public in the browser.

The API health check is available at `http://localhost:5008/health` during local development.

## Generate a study resource

The study-generation endpoint runs only in Development and accepts PDF, PPTX, DOCX, or TXT files (up to three files, 20 MB each). It extracts text in memory and sends that text to OpenAI only after the learner selects a mode and confirms the notice. It does not save a document copy. Broaden mode also uses web search and returns clickable references.

Configure `OPENAI_API_KEY` in the API process using the .NET user-secrets store or a local environment variable. Never put an API key in React/Vite settings, source files, or Git. Without the key, the page reports that AI generation is not configured. Use only material you have permission to process; use synthetic or sanitized files until the privacy and provider review for real learner data is complete.

To start the API with a key in a hidden PowerShell prompt, stop the existing API with **Ctrl+C** and run this from the repository root. The key is not written to project files or shell history; it is removed from the terminal environment when the API stops:

```powershell
$secureKey = Read-Host "OpenAI API key" -AsSecureString
$keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
  $env:OPENAI_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
  dotnet run --project .\src\api\UniAi.Api.csproj
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
  Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue
  Remove-Variable secureKey, keyPointer -ErrorAction SilentlyContinue
}
```

## Choose an AI provider

Set `AI__Provider` to `openai` (default), `gemini` or `groq`, plus that provider's key (`OPENAI_API_KEY`, `GEMINI_API_KEY` or `GROQ_API_KEY`). Models can be changed with `OpenAI:Model`, `Gemini:Model` and `Groq:Model`. Summary and quiz work with all three; "Broaden my knowledge" (web search) currently needs OpenAI. Free tiers have rate limits, and Google's free tier may use submitted content to improve its products, so use only synthetic or non-sensitive files with it.

## Working principles

1. Build and review one small feature at a time.
2. Keep secrets and real student records out of source control and early demos.
3. Show sources for answers based on uploaded learning material.
4. Treat generated explanations and questions as drafts that need quality checks.
5. Use Git checkpoints before each meaningful change.
