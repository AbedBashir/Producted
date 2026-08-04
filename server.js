// Standalone entry point for hosts (like Hostinger's Node.js app runner) that
// invoke `node <file>` directly instead of running an npm script. It does the
// same job as `react-router-serve ./build/server/index.js` (our `npm start`),
// just without needing that CLI to be the process entry point.
import { createRequestHandler } from "@react-router/express";
import express from "express";
import * as build from "./build/server/index.js";

const app = express();

app.use(
  "/assets",
  express.static("build/client/assets", { immutable: true, maxAge: "1y" }),
);
app.use(express.static("build/client", { maxAge: "1h" }));

app.all("*", createRequestHandler({ build }));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Producted server listening on port ${port}`);
});
