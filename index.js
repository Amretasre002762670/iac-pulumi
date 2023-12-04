require('dotenv').config();
const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");

const subnetsModule = require("./resources/subnet");
const routeTable = require("./resources/routeTable");
const routeTableAssociation = require("./resources/routeTableAssociation");
const route = require("./resources/publicRoute");
const subnetCidr = require("./utils/generateCidr");
const role = require("./resources/iamRole");
const sns = require("./resources/sns");
const gcp = require("@pulumi/gcp");

const config = new pulumi.Config('devPulumiConfig');
// const credentialsConfig = new pulumi.Config('awsCredentials');

const main = new aws.ec2.Vpc(config.require('vpcName'), {
    cidrBlock: config.require('defaultCidr'),
    instanceTenancy: "default",
    tags: {
        Name: config.require('vpcName'),
    },
});

const igw = new aws.ec2.InternetGateway(config.require('igwName'), {
    vpcId: main.id,
    tags: {
        Name: config.require('igwName'),
    },
});


const publicRouteTable = routeTable.createPublicRouteTable(main, igw, config.require('publicRoutingTableName'));


const privateRouteTable = routeTable.createPrivateRouteTable(main, config.require('privateRoutingTableName'));

// const rdsEndpoint = pulumi.interpolate`${rdsInstance.endpoint}`;

const mainNetwork = config.require('defaultCidr');
const subnetMask = config.require('subnetMask');
const selectedRegion = config.require('selectedRegion');

const created_subnet_arr = [];
const private_subnet_arr = [];
const domainName = config.require('domainName');
const port = config.require('port');


const cloudwatch_role = role.createIAMRole(config.require('cloudwatchRoleName'), config.require('cloudWatchPolicy'));

const instanceProfile = new aws.iam.InstanceProfile(config.require("instanceProfileName"), {
    name: config.require("instanceProfileName"),
    role: cloudwatch_role.name,
});

async function createSubnet() {
    try {
        const selectedRegionAvailabilityZones = await aws.getAvailabilityZones({
            state: "available",
            region: selectedRegion,
        });

        const hostedZone = aws.route53.getZone({
            name: domainName,
        });

        const selectedRegionAvailabilityZonesLength = (selectedRegionAvailabilityZones.names || []).length;
        const maxSubnets = 3;
        const totalSubnets = Math.min(selectedRegionAvailabilityZonesLength, maxSubnets)

        const baseIp = config.require("defaultCidr");
        const subnetMask = config.require("subnetMask");

        const subnets_arr = subnetCidr.generateCidr(baseIp, totalSubnets * 2, subnetMask);

        const publicSubnetsCidr = subnets_arr.slice(0, totalSubnets);
        const privateSubnetsCidr = subnets_arr.slice(totalSubnets);

        for (let i = 0; i < totalSubnets; i++) {
            const availabilityZone = selectedRegionAvailabilityZones.names[i];
            const publicSubnetCidr = publicSubnetsCidr[i];
            const privateSubnetCidr = privateSubnetsCidr[i];


            const publicSubnet = subnetsModule.createSubnets(main, `csye6225-public-subnet-${i + 1}`, availabilityZone, publicSubnetCidr);
            created_subnet_arr.push(publicSubnet);

            const privateSubnet = subnetsModule.createSubnets(main, `csye6225-private-subnet-${i + 1}`, availabilityZone, privateSubnetCidr);
            private_subnet_arr.push(privateSubnet);


            const subnetPublicAssociation = routeTableAssociation.createRouteTableAssociation(
                publicRouteTable,
                publicSubnet,
                `csye6225-public-routing-association-${i + 1}`
            );

            const subnetPrivateAssociation = routeTableAssociation.createRouteTableAssociation(
                privateRouteTable,
                privateSubnet,
                `csye6225-private-routing-association-${i + 1}`
            );
        }

        // for (let i = 0; i < totalSubnets; i++) {
        //     const availabilityZone = selectedRegionAvailabilityZones.names[i];
        //     const privateSubnetCidr = privateSubnetsCidr[i];

        //     // Create the private subnets using your existing functions
        //     const privateSubnet = subnetsModule.createSubnets(main, `csye6225-private-subnet-${i + 1}`, availabilityZone, privateSubnetCidr);

        //     // Create route table associations as needed
        //     const subnetPrivateAssociation = routeTableAssociation.createRouteTableAssociation(
        //         privateRouteTable,
        //         privateSubnet,
        //         `csye6225-private-routing-association-${i + 1}`
        //     );
        // }

        const publicRoute = route.createPublicRoutes(publicRouteTable, igw, config.require('publicRouteName'));

        const snsArn = sns.snsArn();

        // const snsArn = pulumi.output(config.require('snsTopic')).apply(async (snsTopicName) => {
        //     const snsTopic = await new aws.sns.Topic(snsTopicName);
        //     return snsTopic.arn;
        // });

        // const snsArnInterpolated = pulumi.interpolate`${snsArn}`;
        // const accessIdOutput = new pulumi.Output(credentialsConfig.require("accessKey")).apply(value => value);
        // const secretAccessKeyOutput = new pulumi.Output(credentialsConfig.require("secretAccessKey")).apply(value => value);

        const loadBalancerSecurityGroup = new aws.ec2.SecurityGroup(config.require("loadBalancerSg"), {
            vpcId: main.id,
            description: "Load Balancer Security Group",
            ingress: [
                {
                    protocol: config.require('protocol'),
                    fromPort: config.require('http_from_port'),
                    toPort: config.require('http_to_port'),
                    cidrBlocks: [config.require('ipv4')],
                },
                {
                    protocol: config.require('protocol'),
                    fromPort: config.require('https_from_port'),
                    toPort: config.require('https_to_port'),
                    cidrBlocks: [config.require('ipv4')],
                },
            ],
            egress: [{ protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }],
            tags: {
                Name: config.require('loadBalancerSg'),
            },
        });

        const sg = new aws.ec2.SecurityGroup(config.require('sgName'), {
            vpcId: main.id,
            description: "CSYE6225 Security group for Node app",
            ingress: [
                {
                    fromPort: config.require('ssh_from_port'),
                    toPort: config.require('ssh_to_port'),
                    protocol: config.require('protocol'),
                    cidrBlocks: [config.require('ipv4')],
                },
                // {
                //     fromPort: config.require('http_from_port'),
                //     toPort: config.require('http_from_port'),
                //     protocol: config.require('protocol'),
                //     cidrBlocks: [config.require('ipv4')],
                //     // ipv6CidrBlocks: [config.config['iac-pulumi:ipv6_cidr_blocks']], 
                // },
                // {
                //     fromPort: config.require('https_from_port'), 
                //     toPort: config.require('https_from_port'),
                //     protocol: config.require('protocol'),
                //     cidrBlocks: [config.require('ipv4')],
                //     // ipv6CidrBlocks: [config.config['iac-pulumi:ipv6_cidr_blocks']], 
                // },
                {
                    fromPort: config.require('webapp_from_port'),
                    toPort: config.require('webapp_from_port'),
                    protocol: config.require('protocol'),
                    // cidrBlocks: [config.require('ipv4')],
                    securityGroups: [loadBalancerSecurityGroup.id],
                    // ipv6CidrBlocks: [config.config['iac-pulumi:ipv6_cidr_blocks']], 
                },
            ],
            egress: [{ protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }],
            tags: {
                Name: config.require('sgName'),
            },
        });

        const customParameterGroup = new aws.rds.ParameterGroup(config.require("rdsName"), {
            family: config.require('dbTypePg'),
            description: "Custom parameter group for csye 6225 db",
            parameters: [
                {
                    name: "max_connections",
                    value: config.require('dbMaxConnections'),
                },
            ],
            tags: {
                Name: config.require("rdsName"),
            },
        });

        const mySubnetGroup = new aws.rds.SubnetGroup(config.require('subnetGroupName'), {
            subnetIds: private_subnet_arr.map(subnet => subnet.id),
            tags: {
                Name: config.require('subnetGroupName'),
            }, // Use the appropriate subnets (e.g., public or private)
        });

        const sgDB = new aws.ec2.SecurityGroup(config.require('sgRDSName'), {
            vpcId: main.id,
            description: "CSYE6225 Security group for Node app",
            ingress: [
                {
                    fromPort: config.require('db_from_port'),
                    toPort: config.require('db_to_port'),
                    protocol: config.require('protocol'),
                    securityGroups: [sg.id]
                },
            ],
            egress: [{ protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }],
            tags: {
                Name: config.require('sgRDSName'),
            },
        });

        const dbInstance = new aws.rds.Instance(config.require("dbInstanceName"), {
            allocatedStorage: 20,
            storageType: "gp2",
            instanceClass: "db.t3.micro",
            engine: config.require("dbEngine"),
            dbName: config.require("dbName"),
            username: config.require("dbInstanceUserName"),
            password: config.require("dbInstancePassword"),
            parameterGroupName: customParameterGroup.name,
            dbSubnetGroupName: mySubnetGroup.name,
            skipFinalSnapshot: true,
            vpcSecurityGroupIds: [sgDB.id],
            publiclyAccessible: false,
            // provisioned: {
            //     maxRetries: 10,
            //     retryInterval: 10,
            // },
        });

        const dbEndpoint = dbInstance.endpoint;
        const dbHost = dbEndpoint.apply(endpoint => endpoint.split(":")[0]);
        const dbInstancePassword = config.require("dbInstancePassword");
        const dbInstanceUserName = config.require("dbInstanceUserName");
        const userDataScript = pulumi.all([dbHost, dbInstancePassword, dbInstanceUserName, snsArn]).apply(
            ([host, password, userName, sns]) => pulumi.interpolate`#!/bin/bash
                echo "Setting up environment variables"
                echo "export HOST=${host}" >> /etc/environment
                echo "export MYSQLUSER=${userName}" >> /etc/environment
                echo "export PASSWORD=${password}" >> /etc/environment
                echo "export TOPICARN=${sns}" >> /etc/environment
        
                source /etc/environment
        
                echo "HOST is: $HOST"
                echo "MYSQLUSER is: $MYSQLUSER"
                echo "TOPICARN is: $TOPICARN"
        
                sudo systemctl daemon-reload
        
                sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a append-config -m ec2 -c file:/opt/cloudwatch-config.json -s
        
                sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -c file:/opt/dist/cloudwatch-config.json -s
        
                sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a stop
                sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a start
        
                sudo systemctl enable Assignment-node-app.service
                sudo systemctl start Assignment-node-app.service
            `
        );

        // let userDataScript = dbHost.apply(host =>
        //     `#!/bin/bash
        //     echo "Setting up environment variables"

        //     echo 'export HOST=${host}' >> /etc/environment
        //     echo 'export MYSQLUSER=${config.require("dbInstanceUserName")}' >> /etc/environment
        //     echo 'export PASSWORD=${config.require("dbInstancePassword")}' >> /etc/environment

        //     echo "export TOPICARN=${snsArnInterpolated}" >> /etc/environment
        //     echo "export accessId=$(pulumi interpolate '${accessIdOutput}')" >> /etc/environment
        //     echo "export secretAccessKey=$(pulumi interpolate '${secretAccessKeyOutput}')" >> /etc/environment

        //     echo "export AWS_SDK_LOAD_CONFIG=1" >> /etc/environment

        //     echo "export AWS_CONFIG_FILE=/opt/dist/config/aws-config.js" >> /etc/environment

        //     source /etc/environment

        //     echo "HOST is: $HOST"
        //     echo "MYSQLUSER is: $MYSQLUSER"
        //     echo "AWS_CONFIG_FILE is: $AWS_CONFIG_FILE"

        //     export AWS_SDK_LOAD_CONFIG=1

        //     sudo systemctl daemon-reload

        //     sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a append-config -m ec2 -c file:/opt/cloudwatch-config.json -s

        //     sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -c file:/opt/dist/cloudwatch-config.json -s

        //     sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a stop
        //     sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a start

        //     sudo systemctl enable Assignment-node-app.service
        //     sudo systemctl start Assignment-node-app.service
        //     `
        // );

        // Create an EC2 instance
        // const ec2Instance = new aws.ec2.Instance(config.require("ec2InstanceName"), {
        //     ami: config.require("amiId"),
        //     iamInstanceProfile: instanceProfile.name,
        //     instanceType: "t2.micro",
        //     subnetId: created_subnet_arr[0].id,
        //     keyName: config.require('keyName'),
        //     associatePublicIpAddress: true,
        //     vpcSecurityGroupIds: [sg.id,],
        //     securityGroupIds: [sg.id],
        //     rootBlockDevice: {
        //         volumeType: "gp2",
        //         volumeSize: 25,
        //         deleteOnTermination: true,
        //     },
        //     creditSpecification: {
        //         cpuCredits: "standard",
        //     },
        //     tags: {
        //         Name: config.require("ec2InstanceName"),
        //     },
        //     userData: userDataScript
        // });


        const launchTemplate = new aws.ec2.LaunchTemplate(config.require("launchTemplate"), {
            name: config.require("launchTemplate"),
            imageId: config.require("amiId"),
            instanceType: "t2.micro",
            keyName: config.require('keyName'),
            userData: pulumi.interpolate`${userDataScript}`.apply(script => Buffer.from(script).toString('base64')),
            iamInstanceProfile: {
                name: instanceProfile.name,
            },
            networkInterfaces: [
                {
                    associatePublicIpAddress: true,
                    securityGroups: [sg.id],
                    subnetId: created_subnet_arr[0].id,
                },
            ],
            tags: {
                Name: config.require("launchTemplate"),
            }
        });

        const targetGroup = new aws.lb.TargetGroup(config.require("targetGroupName"), {
            port: config.require("port"),
            protocol: "HTTP",
            targetType: "instance",
            vpcId: main.id,
            healthCheck: {
                enabled: true,
                healthyThreshold: config.require("healthyThreshold"),
                path: config.require("healthRoute"),
                port: config.require("port"),
                protocol: config.require("protocolTG"),
                interval: config.require("intervalTG"),
                timeout: config.require("timeoutTG"),
            },
        },
            {
                dependsOn: [dbInstance], // Specify the dependency on the RDS instance
            }
        );

        const autoScalingGroup = new aws.autoscaling.Group(config.require("autoScalingGroup"), {
            name: config.require("autoScalingGroup"),
            vpcZoneIdentifiers: created_subnet_arr,
            launchTemplate: {
                id: launchTemplate.id,
                version: "$Latest",
            },
            minSize: config.require("AsMinTries"),
            maxSize: config.require("AsMaxTries"),
            desiredCapacity: config.require("AsDesiredCapacity"),
            targetGroupArns: [targetGroup.arn],
            defaultCooldown: config.require("AsDefaultCooldown"),
            // healthCheckType: "EC2",
            // healthCheckGracePeriod: 300,
            tags: [
                {
                    key: "Name",
                    value: config.require("autoScalingGroup"),
                    propagateAtLaunch: true,
                },
            ],
        });

        const scaleUpPolicy = new aws.autoscaling.Policy(config.require("scaleUpPolicy"), {
            scalingAdjustment: config.require("scalingUpAdjustments"),
            adjustmentType: config.require("adjustmentType"),
            cooldown: config.require("coolDown"),
            autoscalingGroupName: autoScalingGroup.name,
            policyType: config.require("policyType"),
        });

        const scaleDownPolicy = new aws.autoscaling.Policy(config.require("scaleDownPolicy"), {
            scalingAdjustment: config.require("scalingDownAdjustments"),
            adjustmentType: config.require("adjustmentType"),
            cooldown: config.require("coolDown"),
            autoscalingGroupName: autoScalingGroup.name,
            policyType: config.require("policyType"),
        });

        const cpuAlarmScaleUp = new aws.cloudwatch.MetricAlarm(config.require("cpuAlarmScaleUpName"), {
            alarmName: config.require("cpuAlarmScaleUpName"),
            comparisonOperator: "GreaterThanThreshold",
            evaluationPeriods: config.require("evaluationPeriods"),
            threshold: config.require("scalingUpThreshold"),
            namespace: "AWS/EC2",
            metricName: config.require("scalingMetricName"),
            period: config.require("scalingPeriod"),
            statistic: config.require("scalingStatistic"),
            dimensions: {
                AutoScalingGroupName: autoScalingGroup.name,
            },
            alarmActions: [scaleUpPolicy.arn],
            actionsEnabled: true,
        });

        const cpuAlarmScaleDown = new aws.cloudwatch.MetricAlarm(config.require("cpuAlarmScaleDownName"), {
            alarmName: config.require("cpuAlarmScaleUpName"),
            comparisonOperator: "LessThanThreshold",
            evaluationPeriods: config.require("evaluationPeriods"),
            threshold: config.require("scalingDownThreshold"),
            namespace: "AWS/EC2",
            metricName: config.require("scalingMetricName"),
            period: config.require("scalingPeriod"),
            statistic: "Average",
            dimensions: {
                AutoScalingGroupName: autoScalingGroup.name,
            },
            alarmActions: [scaleDownPolicy.arn],
            actionsEnabled: true,
        });

        const loadBalancer = new aws.lb.LoadBalancer(config.require("loadBalancerName"), {
            internal: false,
            enableDeletionProtection: false,
            securityGroups: [loadBalancerSecurityGroup.id],
            subnets: created_subnet_arr,
            // enableHttp2: true,
            // enableCrossZoneLoadBalancing: true,
            // idleTimeout: 60,
            loadBalancerType: "application",
            ipAddressType: config.require("loadBalancerIPType"),
        });

        const httpListener = new aws.lb.Listener(config.require("httpListnerName"), {
            loadBalancerArn: loadBalancer.arn,
            port: config.require("https_from_port"),
            protocol: config.require("listnerProtocol"),
            defaultActions: [
                {
                    type: config.require("httpListnerDefaultType"),
                    targetGroupArn: targetGroup.arn,
                },
            ],
            sslPolicy: "ELBSecurityPolicy-2016-08",
            certificateArn: config.require("certificateARN"),
        });

        const zoneId = hostedZone.then(zone => zone.id);

        const aRecord = new aws.route53.Record(
            config.require("route53Name"),
            {
                name: domainName,
                type: "A",
                zoneId: zoneId,
                // ttl: config.require("ttl"),
                aliases: [
                    {
                        evaluateTargetHealth: true,
                        name: loadBalancer.dnsName,
                        zoneId: loadBalancer.zoneId,
                    },
                ],
                tags: {
                    Name: config.require("route53Name"),
                },
            },
        );

        const serviceAccount = new gcp.serviceaccount.Account(config.require("serviceAcctName"), {
            accountId: config.require("serviceAcctName"),
            displayName: "CSYE6225 Demo Account",
        });

        const serviceAccountKey = new gcp.serviceaccount.Key(config.require("cloudAcctKey"), {
            serviceAccountId: serviceAccount.name,
        });

        const myBucket = new gcp.storage.Bucket(config.require("bucketName"), {
            location: config.require("bucketLocation"),
            forceDestroy: true,
        });

        const bucketIAMBinding = new gcp.storage.BucketIAMBinding("my-bucket-iam-binding", {
            bucket: myBucket.name,
            members: [
                serviceAccount.email.apply(email => `serviceAccount:${email}`),
            ],
            role: "roles/storage.objectCreator",
        });

        const bucketIAMBinding_2 = new gcp.storage.BucketIAMBinding("my-bucket-iam-binding-admin", {
            bucket: myBucket.name,
            members: [
                serviceAccount.email.apply(email => `serviceAccount:${email}`),
            ],
            role: "roles/storage.objectAdmin",
        });

        const lambdaRole = new aws.iam.Role(config.require("lambdaRole"), {
            assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "lambda.amazonaws.com" })
        });

        const lambdaRolePolicyAttachment = new aws.iam.RolePolicyAttachment("myLambdaRolePolicyAttachment", {
            role: lambdaRole,
            policyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
        });

        const lambdaRolePolicyAttachment_2 = new aws.iam.RolePolicyAttachment("myLambdaRolePolicyAttachment_2", {
            role: lambdaRole,
            policyArn: "arn:aws:iam::aws:policy/AmazonSNSFullAccess",
        });

        const cloudwatchLogsPolicy = new aws.iam.Policy("cloudwatchLogsPolicy", {
            policy: {
                Version: "2012-10-17",
                Statement: [
                    {
                        Effect: "Allow",
                        Action: [
                            "logs:CreateLogGroup",
                            "logs:CreateLogStream",
                            "logs:PutLogEvents",
                        ],
                        Resource: "arn:aws:logs:*:*:*",
                    },
                ],
            },
        });

        const lambdaRolePolicyAttachment_3 = new aws.iam.RolePolicyAttachment("lambdaRolePolicyAttachment_3", {
            role: lambdaRole.name,
            policyArn: cloudwatchLogsPolicy.arn,
        });

        const lambdaRolePolicyAttachment_4 = new aws.iam.RolePolicyAttachment("dynamoDBPolicy", {
            role: lambdaRole.name,
            policyArn: config.require("dynamoDBARN"),
        });

        const dynamoTable = new aws.dynamodb.Table(config.require("dynamoDbTableName"), {
            attributes: [
                { name: "submissionId", type: "S" },
            ],
            hashKey: "submissionId",
            billingMode: "PAY_PER_REQUEST",
        });

        const lambdaFunction = new aws.lambda.Function(config.require("lambdaFunctionName"), {
            handler: config.require("handler"),
            role: lambdaRole.arn,
            functionName: config.require("lambdaFunctionName"),
            runtime: config.require("runtime"),
            code: new pulumi.asset.AssetArchive({
                ".": new pulumi.asset.FileArchive("./serverless.zip"),
            }),
            packageType: "Zip",
            environment: {
                variables: {
                    BUCKET_NAME: myBucket.name,
                    // SNS_TOPIC_ARN: snsArn,
                    SERVICE_ACCOUNT_KEY: serviceAccountKey.privateKey,
                    MAILGUN_API_KEY: config.require("mailApi"),
                    MAILGUN_DOMAIN: config.require("mailDomain"),
                    DYNAMO_DB_TABLE_NAME: dynamoTable.name
                },
            },
        });

        const snsLambdaPermission = new aws.lambda.Permission("lambdaPermission", {
            action: "lambda:InvokeFunction",
            function: lambdaFunction.arn,
            principal: "sns.amazonaws.com",
            sourceArn: snsArn,
        });

        const snsSubscription = new aws.sns.TopicSubscription("snsSubscription", {
            protocol: "lambda",
            topic: snsArn,
            endpoint: lambdaFunction.arn,
        });

    } catch (error) {
        console.error("Error while creating subnets:", error);
    }
}

createSubnet();


