import { TerraformVariable } from "cdktf";
import { Construct } from "constructs";

export interface Config {
  project: string;
  service: string;
  env: string;
  region: string;
  containerPort: number;
  imageTag: string;

  az1: string;
  az2: string;

  taskCpu: string;
  taskMemory: string;

  // computed values
  prefix: string;              // project-service-env
  tags: Record<string, string> // AWS tagging convention
}

export function loadConfig(scope: Construct): Config {

  // ---------------------------
  // Base variables (user-supplied)
  // ---------------------------

  const projectVar = new TerraformVariable(scope, "project", {
    type: "string",
    description: "Project name (e.g. turbo, payments, analytics)",
    default: "turbo",
  });

  const serviceVar = new TerraformVariable(scope, "service", {
    type: "string",
    description: "Service name (e.g. api, worker, ingestion)",
    default: "app",
  });

  const envVar = new TerraformVariable(scope, "env", {
    type: "string",
    description: "Deployment environment (dev/staging/prod)",
    default: "dev",
  });

  const regionVar = new TerraformVariable(scope, "region", {
    type: "string",
    description: "AWS region for deployment",
    default: "us-east-2",
  });

  const containerPortVar = new TerraformVariable(scope, "container_port", {
    type: "number",
    description: "Port the container listens on",
    default: 3000,
  });

  const imageTagVar = new TerraformVariable(scope, "image_tag", {
    type: "string",
    description: "Docker image tag to deploy",
    default: "latest",
  });

  // ---------------------------
  // Availability Zones
  // ---------------------------

  const az1Var = new TerraformVariable(scope, "az1", {
    type: "string",
    description: "Primary Availability Zone",
    default: "us-east-2a",
  });

  const az2Var = new TerraformVariable(scope, "az2", {
    type: "string",
    description: "Secondary Availability Zone",
    default: "us-east-2b",
  });

  // ---------------------------
  // ECS Task Sizing
  // ---------------------------

  const taskCpuVar = new TerraformVariable(scope, "task_cpu", {
    type: "string",
    description: "ECS task CPU units",
    default: "256",
  });

  const taskMemoryVar = new TerraformVariable(scope, "task_memory", {
    type: "string",
    description: "ECS task memory (MiB)",
    default: "512",
  });

  // ---------------------------
  // Derived Values
  // ---------------------------

  const project = projectVar.stringValue;
  const service = serviceVar.stringValue;
  const env = envVar.stringValue;

  const prefix = `${project}-${service}-${env}`;

  const tags: Record<string, string> = {
    Project: project,
    Service: service,
    Environment: env,
    ManagedBy: "cdktf",
  };

  return {
    project,
    service,
    env,
    region: regionVar.stringValue,
    containerPort: containerPortVar.numberValue,
    imageTag: imageTagVar.stringValue,

    az1: az1Var.stringValue,
    az2: az2Var.stringValue,

    taskCpu: taskCpuVar.stringValue,
    taskMemory: taskMemoryVar.stringValue,

    prefix,
    tags,
  };
}