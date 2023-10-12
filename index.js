require('dotenv').config();
const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");

const subnets = require("./resources/subnet");
const routeTable = require("./resources/routeTable");
const routeTableAssociation = require("./resources/routeTableAssociation");
const route = require("./resources/publicRoute");

// const awsProfile = pulumi.get("aws:profile");

const main = new aws.ec2.Vpc(process.env.VPC_NAME, {
    cidrBlock: "10.0.0.0/16",
    instanceTenancy: "default",
    tags: {
        Name: process.env.VPC_NAME,
        // Environment: awsProfile
    },
});

const igw = new aws.ec2.InternetGateway(process.env.GW_NAME, {
    vpcId: main.id,
    tags: {
        Name: process.env.GW_NAME,
        // Environment: awsProfile
    },
});

// Create a public subnet
const publicSubnet_1a = subnets.createSubnets(main, process.env.PUBLIC_SUBNET_1_NAME, "us-east-1a", "10.0.1.0/24");
const publicSubnet_1b = subnets.createSubnets(main, process.env.PUBLIC_SUBNET_2_NAME, "us-east-1b", "10.0.2.0/24");
const publicSubnet_1c = subnets.createSubnets(main, process.env.PUBLIC_SUBNET_3_NAME, "us-east-1c", "10.0.3.0/24");

// Create a private subnets
const privateSubnet_1a = subnets.createSubnets(main, process.env.PRIVATE_SUBNET_1_NAME, "us-east-1a", "10.0.4.0/24");
const privateSubnet_1b = subnets.createSubnets(main, process.env.PRIVATE_SUBNET_2_NAME, "us-east-1b", "10.0.5.0/24");
const privateSubnet_1c = subnets.createSubnets(main, process.env.PRIVATE_SUBNET_3_NAME, "us-east-1c", "10.0.6.0/24");

// Create Public Route Table
const publicRouteTable = routeTable.createPublicRouteTable(main, igw, process.env.PUBLIC_ROUTE_TABLE_NAME);

// Create Private Route Table
const privateRouteTable = routeTable.createPrivateRouteTable(main, process.env.PRIVATE_ROUTE_TABLE_NAME);

// Create Public route table and subnet association

const publicSubnetAssociation_1 = routeTableAssociation.createRouteTableAssociation(publicRouteTable, publicSubnet_1a, process.env.PUBLIC_ROUTE_SUBNET_ASSOCIATION_1_NAME);
const publicSubnetAssociation_2 = routeTableAssociation.createRouteTableAssociation(publicRouteTable, publicSubnet_1b, process.env.PUBLIC_ROUTE_SUBNET_ASSOCIATION_2_NAME);
const publicSubnetAssociation_3 = routeTableAssociation.createRouteTableAssociation(publicRouteTable, publicSubnet_1c, process.env.PUBLIC_ROUTE_SUBNET_ASSOCIATION_3_NAME);

// Create private route table and subnet association

const privateSubnetAssociation_1 = routeTableAssociation.createRouteTableAssociation(privateRouteTable, privateSubnet_1a, process.env.PRIVATE_ROUTE_SUBNET_ASSOCIATION_1_NAME);
const privateSubnetAssociation_2 = routeTableAssociation.createRouteTableAssociation(privateRouteTable, privateSubnet_1b, process.env.PRIVATE_ROUTE_SUBNET_ASSOCIATION_2_NAME);
const privateSubnetAssociation_3 = routeTableAssociation.createRouteTableAssociation(privateRouteTable, privateSubnet_1c, process.env.PRIVATE_ROUTE_SUBNET_ASSOCIATION_3_NAME);

// Creating public route

const publicRoute = route.createPublicRoutes(publicRouteTable, igw, process.env.PUBLIC_ROUTE_NAME);



