require('dotenv').config();
const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");

const config = new pulumi.Config('devPulumiConfig');

function createIAMRole(roleName, cloudwatchPolicy) {

    const snsCreationPolicy = new aws.iam.Policy('snsCreationPolicy', {
        name: config.require('snsPolicyCreationName'),
        policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
                {
                    Action: 'sns:Publish',
                    Effect: 'Allow',
                    Resource: '*',
                },
            ],
        }),
    });

    const role = new aws.iam.Role(roleName, {
        name: roleName,
        assumeRolePolicy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [{
                Action: 'sts:AssumeRole',
                Effect: 'Allow',
                Principal: {
                    Service: 'ec2.amazonaws.com',
                },
            }],
        }),
        tags: {
            Name: roleName
        }
    });
    // Attach the CloudWatchAgentServerPolicy to the role
    const policyAttachment = new aws.iam.PolicyAttachment("policyAttachment_cloudwatch", {
        roles: [role.name],
        policyArn: cloudwatchPolicy,
    });
    
    const snsPolicyAttachment = new aws.iam.PolicyAttachment('policyAttachment_sns', {
        policyArn: snsCreationPolicy.arn,
        roles: [role.name],
    });

    // const policyAttachment_log4js = new aws.iam.PolicyAttachment("policyAttachment_log4js", {
    //     roles: [role.name],
    //     policyArn: log4Policy,
    // });

    return role;
}

module.exports = {
    createIAMRole
}

