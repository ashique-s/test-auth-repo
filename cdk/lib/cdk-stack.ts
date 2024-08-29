import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  BaseStack,
  ClientCredentialsCognitoProps,
} from "@erm/cdk-constructs";


import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  PhysicalResourceId,
} from "aws-cdk-lib/custom-resources";

import * as cognito from "aws-cdk-lib/aws-cognito";

export class CdkStack extends BaseStack {
  private cognitoProps: ClientCredentialsCognitoProps;
  private readonly scopes: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.scopes = scope.node.tryGetContext("scopes");
  }

  public async Build() {
    const cognitoScopes = this.scopes.split(",");

    this.cognitoProps = {
      scopeIdentifier: this.appName,
      appName: this.appName,
      clientCredentialsScopes: [],
      platform: this.platform,
      stage: this.stage,
    };

    cognitoScopes.forEach((scope: string) => {
      this.cognitoProps.clientCredentialsScopes?.push({
        scopeDescription: `Scope for ${scope.trim()}`,
        scopeName: scope.trim(),
      });
    });

    // await new ClientCredentialsCognitoBase(
    //   this,
    //   `${this.resourcePrefix}-ClientCredentialCognito`,
    //   this.cognitoProps,
    // );

    // create a userPool
    // Create the User Pool
    const userPool = await new cognito.UserPool(
      this,
      `${this.resourcePrefix}userPool`,
      {
        userPoolName: "app-userPool",
        selfSignUpEnabled: true,
        signInAliases: { email: true },
        autoVerify: { email: true },
        standardAttributes: {
          email: { required: true, mutable: true },
        },
      },
    );

    // Create the User Pool Client
    const userPoolClient = await new cognito.UserPoolClient(
      this,
      `${this.resourcePrefix}userPoolClient`,
      {
        userPool,
        generateSecret: true,
        oAuth: {
          scopes: [
            cognito.OAuthScope.OPENID,
            cognito.OAuthScope.PROFILE,
            cognito.OAuthScope.EMAIL,
          ],
        },
      },
    );

    // Configure the domain
    const domain = new cognito.UserPoolDomain(this, "MyUserPoolDomain", {
      userPool,
      cognitoDomain: {
        domainPrefix: "rtl-market-test-auth", // This must be unique across all Cognito domains
      },
    });

    // Output the User Pool ID and Client ID
    await new cdk.CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId,
    });

    await new cdk.CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
    });

    await new cdk.CfnOutput(this, "tokenURL", {
      value: `https://${domain.domainName}.auth.${this.region}.amazoncognito.com/oauth2/token`,
    });

    // Store Client ID and Client Secret in SSM Parameter Store using AwsCustomResource
    const storeParameters = new AwsCustomResource(this, "StoreParameters", {
      onCreate: {
        service: "SSM",
        action: "putParameter",
        parameters: {
          Name: "/myapp/cognito/clientId",
          Value: userPoolClient.userPoolClientId,
          Type: "SecureString",
          Overwrite: true,
        },
        physicalResourceId: PhysicalResourceId.of(
          userPoolClient.userPoolClientId,
        ),
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({
        resources: AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });

    const storeSecret = new AwsCustomResource(this, "StoreSecret", {
      onCreate: {
        service: "SSM",
        action: "putParameter",
        parameters: {
          Name: "/myapp/cognito/clientSecret",
          Value: userPoolClient.userPoolClientSecret.unsafeUnwrap(),
          Type: "SecureString",
          Overwrite: true,
        },
        physicalResourceId: PhysicalResourceId.of(
          userPoolClient.userPoolClientId,
        ),
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({
        resources: AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });

    storeParameters.node.addDependency(userPoolClient);
    storeSecret.node.addDependency(userPoolClient);
  }
}
