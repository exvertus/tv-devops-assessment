import { Construct } from "constructs";
import { App, TerraformStack, TerraformOutput } from "cdktf";

import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
// Networking
import { Vpc } from "@cdktf/provider-aws/lib/vpc";
import { Subnet } from "@cdktf/provider-aws/lib/subnet";
import { InternetGateway } from "@cdktf/provider-aws/lib/internet-gateway";
import { RouteTable } from "@cdktf/provider-aws/lib/route-table";
import { RouteTableAssociation } from "@cdktf/provider-aws/lib/route-table-association";
import { Route } from "@cdktf/provider-aws/lib/route";
import { Eip } from "@cdktf/provider-aws/lib/eip";
import { NatGateway } from "@cdktf/provider-aws/lib/nat-gateway";

import { EcrRepository } from "@cdktf/provider-aws/lib/ecr-repository";
import { EcsCluster } from "@cdktf/provider-aws/lib/ecs-cluster";
import { IamRole } from "@cdktf/provider-aws/lib/iam-role";
import { IamRolePolicyAttachment } from "@cdktf/provider-aws/lib/iam-role-policy-attachment";
import { CloudwatchLogGroup } from "@cdktf/provider-aws/lib/cloudwatch-log-group";
import { EcsTaskDefinition } from "@cdktf/provider-aws/lib/ecs-task-definition";
import { SecurityGroup } from "@cdktf/provider-aws/lib/security-group";
import { SecurityGroupRule } from "@cdktf/provider-aws/lib/security-group-rule";
import { Lb } from "@cdktf/provider-aws/lib/lb";
import { LbListener } from "@cdktf/provider-aws/lib/lb-listener";
import { LbTargetGroup } from "@cdktf/provider-aws/lib/lb-target-group";
import { EcsService } from "@cdktf/provider-aws/lib/ecs-service";

import { loadConfig } from "./variables";

export class IacStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const config = loadConfig(this);

    // ---------------------------
    // Provider
    // ---------------------------
    new AwsProvider(this, "aws", {
      region: config.region,
    });

    // ---------------------------
    // 0. ECR
    // ---------------------------
    const ecrRepo = new EcrRepository(this, "ecr-repo", {
      name: `${config.project}-${config.service}`,
      imageScanningConfiguration: { scanOnPush: true },
      imageTagMutability: "MUTABLE",
      // Needed to be able to destroy when images have been pushed already:
      forceDelete: true,
      tags: config.tags,
    });

    // ---------------------------
    // 1. VPC
    // ---------------------------
    const vpc = new Vpc(this, "vpc", {
      cidrBlock: "10.0.0.0/16",
      instanceTenancy: "default",
      enableDnsSupport: true,
      enableDnsHostnames: true,
      tags: {
        ...config.tags,
        Name: `${config.prefix}-vpc`,
      },
    });

    // ---------------------------
    // 2. Internet Gateway (for public subnets)
    // ---------------------------
    const igw = new InternetGateway(this, `igw`, {
      vpcId: vpc.id,
      tags: {
        Name: `${config.prefix}-igw`,
        ...config.tags,
      },
    });

    // ---------------------------
    // 3. Public Route Table
    // ---------------------------
    const publicRouteTable = new RouteTable(this, `public-rt`, {
      vpcId: vpc.id,
      tags: {
        ...config.tags,
        Name: `${config.prefix}-public-rt`
      },
    });

    // Default route public -> internet
    new Route(this, `public-default-route`, {
      routeTableId: publicRouteTable.id,
      destinationCidrBlock: "0.0.0.0/0",
      gatewayId: igw.id,
    });

    // ---------------------------
    // 4. Public Subnets (two for avaiablity/redundancy)
    // ---------------------------
    const publicSubnetA = new Subnet(this, "public-subnet-a", {
      vpcId: vpc.id,
      cidrBlock: "10.0.1.0/24",
      availabilityZone: config.az1,
      mapPublicIpOnLaunch: true,
      tags: {
        ...config.tags,
        Name: `${config.prefix}-public-a`,
      }
    });

    const publicSubnetB = new Subnet(this, "public-subnet-b", {
      vpcId: vpc.id,
      cidrBlock: "10.0.2.0/24",
      availabilityZone: config.az2,
      mapPublicIpOnLaunch: true,
      tags: {
        ...config.tags,
        Name: `${config.prefix}-public-b`,
      }
    });

    // Route table associations
    new RouteTableAssociation(this, "public-rta-a", {
      subnetId: publicSubnetA.id,
      routeTableId: publicRouteTable.id,
    });

    new RouteTableAssociation(this, "public-rta-b", {
      subnetId: publicSubnetB.id,
      routeTableId: publicRouteTable.id,
    });

    // ---------------------------
    // 5. NAT Gateway
    // Note: For Production High-Availability, it is probably more 
    // appropriate to create two NAT GWs---one per Availability Zone.
    // However, these can add significantly to cost, so I compromised here
    // by just adding one for this demo/assessment.
    // ---------------------------
    const natEip = new Eip(this, "nat-eip", {
      tags: {
        ...config.tags,
        Name: `${config.prefix}-nat-eip`,
      },
    });

    const natGateway = new NatGateway(this, "nat-gw", {
      subnetId: publicSubnetA.id,
      allocationId: natEip.id,
      connectivityType: "public",
      tags: {
        ...config.tags,
        Name: `${config.prefix}-nat-gw`,
      },
    });

    // ---------------------------
    // 6. Private Route Table
    // ---------------------------
    const privateRouteTable = new RouteTable(this, "private-rt", {
      vpcId: vpc.id,
      tags: {
        ...config.tags,
        Name: `${config.prefix}-private-rt`,
      },
    });

    new Route(this, "private-default-route", {
      routeTableId: privateRouteTable.id,
      destinationCidrBlock: "0.0.0.0/0",
      natGatewayId: natGateway.id,
    });

    // ---------------------------
    // 7. Private Subnets (for ECS tasks)
    // ---------------------------
    const privateSubnet1 = new Subnet(this, "private-subnet-az1", {
      vpcId: vpc.id,
      cidrBlock: "10.0.11.0/24",
      availabilityZone: config.az1,
      mapPublicIpOnLaunch: false,
      tags: {
        Name: `${config.prefix}-subnet-private-${config.az1}`,
        ...config.tags,
      },
    });

    const privateSubnet2 = new Subnet(this, "private-subnet-az2", {
      vpcId: vpc.id,
      cidrBlock: "10.0.12.0/24",
      availabilityZone: config.az2,
      mapPublicIpOnLaunch: false,
      tags: {
        Name: `${config.prefix}-subnet-private-${config.az2}`,
        ...config.tags,
      },
    });

    new RouteTableAssociation(this, "rta-private-az1", {
      subnetId: privateSubnet1.id,
      routeTableId: privateRouteTable.id,
    });

    new RouteTableAssociation(this, "rta-private-az2", {
      subnetId: privateSubnet2.id,
      routeTableId: privateRouteTable.id,
    });

    // ======================================================
    // 8. CloudWatch Log Group
    // ======================================================
    const logGroup = new CloudwatchLogGroup(this, `log-group`, {
      name: `/ecs/${config.prefix}`,   // standardized ECS log naming
      retentionInDays: 7,              // more typical retention
      tags: {
        Name: `${config.prefix}-logs`,
        ...config.tags,
      },
    });

    // ======================================================
    // 9. ECS Cluster
    // ======================================================
    const cluster = new EcsCluster(this, `cluster`, {
      name: `${config.prefix}-cluster`,
      setting: [
        {
          name: "containerInsights",
          value: "enabled",
        },
      ],
      tags: {
        Name: `${config.prefix}-cluster`,
        ...config.tags,
      },
    });


    // ------------------------------------------------------
    // 10. ECS Task Execution Role (pull from ECR, push logs)
    // ------------------------------------------------------
    const taskExecutionRole = new IamRole(this, `task-exec-role`, {
      name: `${config.prefix}-task-exec-role`,
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { Service: "ecs-tasks.amazonaws.com" },
            Action: "sts:AssumeRole",
          }
        ]
      }),
      tags: {
        ...config.tags,
        Name: `${config.prefix}-task-exec-role`
      },
    });

    new IamRolePolicyAttachment(this, `task-exec-policy`, {
      role: taskExecutionRole.id,
      policyArn: "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
    });

    // ------------------------------------------------------
    // 11. ECS Task Role (permissions *inside* the container)
    // ------------------------------------------------------
    const taskRole = new IamRole(this, `task-role`, {
      name: `${config.prefix}-task-role`,
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { Service: "ecs-tasks.amazonaws.com" },
            Action: "sts:AssumeRole",
          }
        ]
      }),
      tags: {
        ...config.tags,
        Name: `${config.prefix}-task-role`
      },
    });

    // No inline policy because this app does not touch AWS APIs.
    // Least privilege = zero permissions in this case.

    // ------------------------------------------------------
    // 11. ECS Task Definition
    // ------------------------------------------------------
    const containerName = `${config.prefix}-container`;

    const containerDef = [
      {
        name: containerName,
        image: `${ecrRepo.repositoryUrl}:${config.imageTag}`,
        essential: true,

        portMappings: [
          {
            containerPort: config.containerPort,
            protocol: "tcp",
          },
        ],

        healthCheck: {
          command: [
            "CMD-SHELL",
            `wget --spider -q http://localhost:${config.containerPort}/health || exit 1`
          ],
          interval: 30,
          timeout: 5,
          retries: 3,
          startPeriod: 10,
        },

        logConfiguration: {
          logDriver: "awslogs",
          options: {
            "awslogs-group": logGroup.name,
            "awslogs-region": config.region,
            "awslogs-stream-prefix": "ecs",
          },
        },

        environment: [
          { name: "NODE_ENV", value: "production" },
          { name: "PORT", value: config.containerPort.toString() },
        ],
      },
    ];

    const taskDef = new EcsTaskDefinition(this, "taskdef", {
      family: `${config.prefix}-task`,
      networkMode: "awsvpc",
      requiresCompatibilities: ["FARGATE"],

      // Ensure these are strings
      cpu: config.taskCpu.toString(),
      memory: config.taskMemory.toString(),

      executionRoleArn: taskExecutionRole.arn,
      taskRoleArn: taskRole.arn,

      containerDefinitions: JSON.stringify(containerDef),

      tags: {
        ...config.tags,
        Name: `${config.prefix}-task`,
      },
    });


    // ------------------------------------------------------
    // 12. Security Groups
    // ------------------------------------------------------

    const albSg = new SecurityGroup(this, `alb-sg`, {
      name: `${config.prefix}-alb-sg`,
      description: "Security group for public-facing ALB",
      vpcId: vpc.id,
      tags: {
        ...config.tags,
        Name: `${config.prefix}-alb-sg`,
      },
    });
    // Ingress: allow inbound HTTP
    new SecurityGroupRule(this, `alb-ingress-80`, {
      type: "ingress",
      fromPort: 80,
      toPort: 80,
      protocol: "tcp",
      cidrBlocks: ["0.0.0.0/0"],
      description: "Allow inbound HTTP",
      securityGroupId: albSg.id,
    });
    // Egress: allow all outbound traffic
    new SecurityGroupRule(this, `alb-egress-all`, {
      type: "egress",
      fromPort: 0,
      toPort: 0,
      protocol: "-1",   // all protocols
      cidrBlocks: ["0.0.0.0/0"],
      description: "Allow outbound to anywhere",
      securityGroupId: albSg.id,
    });

    // ECS Task Security Group (for private subnets)
    const taskSg = new SecurityGroup(this, `task-sg`, {
      name: `${config.prefix}-task-sg`,
      vpcId: vpc.id,
      description: "Allow inbound traffic only from ALB to ECS tasks",
      tags: {
        ...config.tags,
        Name: `${config.prefix}-task-sg`,
      },
    });
    // Allow ALB → ECS traffic ONLY
    new SecurityGroupRule(this, `task-ingress-alb`, {
      type: "ingress",
      fromPort: config.containerPort,
      toPort: config.containerPort,
      protocol: "tcp",
      sourceSecurityGroupId: albSg.id,
      securityGroupId: taskSg.id,
    });
    // Allow outbound traffic (required for ECR + CloudWatch + DNS)
    new SecurityGroupRule(this, `task-egress`, {
      type: "egress",
      fromPort: 0,
      toPort: 0,
      protocol: "-1",
      cidrBlocks: ["0.0.0.0/0"],
      securityGroupId: taskSg.id,
    });

    // ---------------------------
    // 13. Load Balancer
    // ---------------------------
    const alb = new Lb(this, "alb", {
      name: `${config.prefix}-alb`,
      loadBalancerType: "application",
      securityGroups: [albSg.id],
      subnets: [publicSubnetA.id, publicSubnetB.id],
      idleTimeout: 60,
      tags: {
        ...config.tags,
        Name: `${config.prefix}-alb`,
      },
    });

    // ---------------------------
    // 14. Target Group (ECS Tasks)
    // ---------------------------
    const targetGroup = new LbTargetGroup(this, "tg", {
      name: `${config.prefix}-tg`,
      port: config.containerPort,
      protocol: "HTTP",
      targetType: "ip",
      vpcId: vpc.id,
      healthCheck: {
        path: "/health",
        healthyThreshold: 2,
        unhealthyThreshold: 2,
        interval: 30,
        timeout: 5,
        matcher: "200-399",
      },
      tags: {
        ...config.tags,
        Name: `${config.prefix}-tg`,
      },
    });

    // ---------------------------
    // 15. Listener (Shhhh...)
    // ---------------------------
    new LbListener(this, "listener", {
      loadBalancerArn: alb.arn,
      port: 80,
      protocol: "HTTP",
      defaultAction: [
        {
          type: "forward",
          targetGroupArn: targetGroup.arn,
        },
      ],
      tags: {
        Name: `${config.prefix}-listener`,
        ...config.tags,
      },
    });

    // ---------------------------
    // 16. ECS Service
    // ---------------------------
    new EcsService(this, "ecs-service", {
      name: `${config.prefix}-service`,
      cluster: cluster.id,
      launchType: "FARGATE",
      taskDefinition: taskDef.arn,
      // TODO: parametrize this
      desiredCount: 1,
      enableEcsManagedTags: true,
      propagateTags: "SERVICE",
      deploymentController: { type: "ECS" },
      healthCheckGracePeriodSeconds: 30,

      networkConfiguration: {
        subnets: [privateSubnet1.id, privateSubnet2.id],
        securityGroups: [taskSg.id],
        assignPublicIp: false,
      },

      loadBalancer: [
        {
          containerName: `${config.prefix}-container`,
          containerPort: config.containerPort,
          targetGroupArn: targetGroup.arn,
        },
      ],

      deploymentMinimumHealthyPercent: 50,
      deploymentMaximumPercent: 200,
    });

    // ---------------------------
    // 17. Terraform Outputs
    // ---------------------------

    new TerraformOutput(this, "ecr_repository_url", {
      value: ecrRepo.repositoryUrl,
      description: "ECR Repository URL for pushing/pulling images",
    });

    new TerraformOutput(this, "ecr_registry_host", {
      value: `\${split("/", ${ecrRepo.fqn}.repository_url)[0]}`,
      description: "ECR registry hostname (no repository name)",
    });

    new TerraformOutput(this, "ecr_repository_name", {
      value: ecrRepo.name,
      description: "ECR repository name (used in image tagging)",
    });

    new TerraformOutput(this, "alb_dns_name", {
      value: alb.dnsName,
      description: "Public DNS of the Application Load Balancer",
    });

    new TerraformOutput(this, "health_check_url", {
      value: `http://${alb.dnsName}/health`,
      description: "Public health endpoint for verifying the deployment",
    });

    // ECS metadata
    new TerraformOutput(this, "ecs_cluster_name", {
      value: cluster.name,
      description: "ECS Cluster name",
    });

    new TerraformOutput(this, "ecs_service_name", {
      value: `${config.prefix}-service`,
      description: "ECS Service name",
    });

    new TerraformOutput(this, "task_definition_arn", {
      value: taskDef.arn,
      description: "Full ARN of the ECS Task Definition",
    });

    new TerraformOutput(this, "vpc_id", {
      value: vpc.id,
      description: "VPC ID",
    });

    new TerraformOutput(this, "public_subnet_ids", {
      value: [publicSubnetA.id, publicSubnetB.id],
      description: "Public subnet IDs",
    });

    new TerraformOutput(this, "private_subnet_ids", {
      value: [privateSubnet1.id, privateSubnet2.id],
      description: "Private subnet IDs",
    });

    new TerraformOutput(this, "target_group_arn", {
      value: targetGroup.arn,
      description: "Target Group ARN for ECS service",
    });

  }
}

const app = new App();
new IacStack(app, "iac");
app.synth();
