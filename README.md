# Visant Labs® | Tools for Designers

<div align="center">
  <h3>AI-powered canvas-based and other design tools</h3>
  <p>Create mockups, manage branding, and design with AI assistance</p>
</div>

## Features

- **Canvas Editor**: Powerful node-based canvas for design workflows
- **AI Image Generation**: Generate mockups and images using Google Gemini
- **Branding Tools**: Create and manage brand identities
- **Budget Management**: Plan and track design budgets
- **Real-time Collaboration**: Work together on canvas projects (optional)
- **Multiple Export Formats**: Export as images, PDFs, and more
- **Mockup Machine**: Generate instant mockups for your design projects
- **Strategy Machine**: Generate strategy content and insights for your branding projects

## Quick Start

### Prerequisites

- Node.js 18+ 
- MongoDB (local or [MongoDB Atlas](https://www.mongodb.com/cloud/atlas))
- Google Gemini API Key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/visantlabs/visantlabs-os.git
   cd visantlabs-os
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp env.example .env.local
   ```
   
   Edit `.env.local` with your configuration. At minimum, you need:
   - `MONGODB_URI` - MongoDB connection string
   - `JWT_SECRET` - Secret for JWT tokens (generate with `npm run generate-jwt-secret`)
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` - For authentication
   - `GOOGLE_GEMINI_API_KEY` - For AI image generation

4. **Run the application**
   ```bash
   # Run both frontend and backend
   npm run dev:all
   
   # Or run separately:
   npm run dev        # Frontend only (port 3000)
   npm run dev:server # Backend only (port 3001)
   ```

The app will be available at `http://localhost:3000`

## Optional Services

The core canvas functionality works without any paid services. However, you can enable additional features:

### AI Features (Google Gemini)
- **Required for**: AI image generation, mockup creation, branding analysis
- **Setup**: See [docs/SETUP_LLM.md](docs/SETUP_LLM.md)
- **Without it**: AI features disabled, canvas still works

### Payments (Stripe)
- **Required for**: Credit purchases, subscriptions
- **Setup**: See [docs/SETUP_STRIPE.md](docs/SETUP_STRIPE.md)
- **Without it**: Payment features disabled

### PIX Payments (AbacatePay)
- **Required for**: PIX payment option (Brazil)
- **Setup**: See [docs/SETUP_ABACATEPAY.md](docs/SETUP_ABACATEPAY.md)
- **Without it**: PIX option unavailable, Stripe payments still work

### Storage (Cloudflare R2)
- **Required for**: Permanent image storage
- **Setup**: See [docs/SETUP_R2.md](docs/SETUP_R2.md)
- **Without it**: Images stored temporarily in base64

### Collaboration (Liveblocks)
- **Required for**: Real-time canvas collaboration
- **Setup**: See [docs/SETUP_LIVEBLOCKS.md](docs/SETUP_LIVEBLOCKS.md)
- **Without it**: Canvas works in individual mode



## Forking & Customization

If you're forking this project for your own deployment, you'll want to customize these files:

### Branding (`config/branding.ts`)

This file centralizes all branding-related content:

```typescript
// config/branding.ts
export const branding = {
  companyName: 'Your Company',
  productName: 'Your Product Name',
  github: { ... },
  support: {
    email: 'your-email@example.com',
    supportEmail: 'support@example.com',
  },
  links: { ... },
  tutorialVideo: { ... },
};
```

### SEO Files

Update these files with your domain before deploying:

- `public/sitemap.xml` - Replace `YOUR_DOMAIN.COM` with your actual domain
- `public/robots.txt` - Replace `YOUR_DOMAIN.COM` with your actual domain

### Environment Variables

Set `VITE_SITE_URL` to your production domain for proper SEO and referral links:

```env
VITE_SITE_URL=https://your-domain.com
```

### Legal Pages

The legal pages (Terms of Service, Privacy Policy, etc.) use translations from:

- `locales/en-US.json`
- `locales/pt-BR.json`

Update the email addresses and company information in these files.

## Development

### Code Formatting

```bash
npm run format      # Format all files
npm run format:check # Check formatting
npm run lint        # Run ESLint
npm run lint:fix    # Fix ESLint errors
```

### Environment Variables

See `env.example` for all available configuration options.

### Database

The project uses MongoDB for data storage. You can use:
- Local MongoDB installation
- MongoDB Atlas (cloud)
- Docker: `docker run -d -p 27017:27017 mongo`

### Scripts

```bash
npm run check-env        # Check environment variables
npm run check-stripe     # Check Stripe configuration
npm run check-r2         # Check R2 configuration
npm run check-mongodb    # Check MongoDB connection
npm run db:studio        # Open Prisma Studio
```

## Documentation

### Setup Guides

- [Setup LLM/AI (Gemini)](docs/SETUP_LLM.md)
- [Setup Stripe Payments](docs/SETUP_STRIPE.md)
- [Setup AbacatePay (PIX)](docs/SETUP_ABACATEPAY.md)
- [Setup Cloudflare R2 Storage](docs/SETUP_R2.md)
- [Setup Liveblocks Collaboration](docs/SETUP_LIVEBLOCKS.md)

### Policies

- [API Key Policy](docs/API_KEY_POLICY.md)

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [React Flow](https://reactflow.dev/) - Canvas library
- [Google Gemini](https://ai.google.dev/) - AI image generation
- [Liveblocks](https://liveblocks.io/) - Real-time collaboration
- [Stripe](https://stripe.com/) - Payment processing

## Support

For issues and questions, please open an issue on GitHub.

## Authors

Created by Pedro Jaques & Visant Company [https://www.visant.co]

---

**Note**: The main feature of this project is the **canvas editor** and **mockup-machine**. All other services are optional and can be configured as needed.
