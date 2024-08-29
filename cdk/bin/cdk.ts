#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { CdkStack } from "../lib/cdk-stack";

async function createApp(): Promise<cdk.App> {
  const app = new cdk.App();

  const stack = new CdkStack(app, "test-cdk-stack");

  await stack.Build();

  return app;
}

createApp();
