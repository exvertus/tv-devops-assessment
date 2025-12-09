## Express App for local development

### Getting Setup
Requirements:
- [node.js](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) version 20.10.0 or higher (24 recommended)
- [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) version 11.0.0 or higher
- [Docker](https://docs.docker.com/engine/install/ubuntu/)
- [Docker Compose](https://docs.docker.com/compose/install/linux/)

Confirm requirements by checking versions:
```
node -v
npm -v
docker -v
docker compose version
```
Choose ONE of the below to install dependencies:
```
npm install              # best for local development
npm ci                   # uses exact dependencies from lock file
npm install --omit=dev   # no dev dependencies (matches production)
```
### Using the app in your environment
First make sure you are in the app/ directory
```
cd [REPO_ROOT]\app
```
You can run, build, and test the app using the package.json scripts:
```
npm run dev       # Runs server with hot reloading
npm run build     # Transpiles typescript to dist/
npm start         # Runs the built app
npm test          # Runs jest tests
npm run lint      # Linter check for src/ files
```
Once the app is running, the API will be available at [http://localhost:3000](http://localhost:3000). 

The health check should return a 200/ok status:
```
> curl http://localhost:3000/health
{"status":"ok"}
```

### Using the app via Docker
First build the Docker image:
```
docker build -t [APP_NAME]:[TAG] .
```
Once the Docker build completes, you can run with Docker itself:
```
docker run -p 3000:3000 [APP_NAME]:[TAG]
```
Or use Docker Compose:

Create app/.env if you don't already have one.
```
cp .env.example .env
```
- NODE_ENV - development by default, but you can change to production (future-ready env var, but makes no difference in app's current state).
- PORT - Local port number to bind to

```
docker compose up --build
```

### Misc notes
- This app includes SIGINT/SIGTERM handling so Docker, ECS, or Kubernetes
can perform clean shutdown operations.