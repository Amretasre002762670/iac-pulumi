require('dotenv').config();
const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");

function createPublicRoutes(publicRouteTable, gw, routeName) {
    const publicRoute = new aws.ec2.Route(routeName, {
        routeTableId: publicRouteTable.id,  // The ID of your public route table
        destinationCidrBlock: "0.0.0.0/0", // The destination CIDR block for all outbound traffic
        gatewayId: gw.id,      // The ID of your internet gateway
        tags: {
            Name: routeName,
            // Environment: awsProfile
        }
    }); 
    return publicRoute;
}

module.exports = {
    createPublicRoutes
}

