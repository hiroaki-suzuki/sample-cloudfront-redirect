#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { CdkStack } from '../lib/cdk-stack'

const app = new cdk.App()

const projectName = 'sample-cloudfront-redirect-cdk'

new CdkStack(app, projectName, {
  projectName,
})
