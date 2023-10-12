require('dotenv').config();
const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");

function createRouteTableAssociation(routeTable, subnet, associationName) {
    const routeTableAssociation = new aws.ec2.RouteTableAssociation(associationName, {
        routeTableId: routeTable.id,
        subnetId: subnet.id,
        tags: {
            Name: associationName,
            // Environment: awsProfile
        }


    });

    return routeTableAssociation;
}

module.exports = {
    createRouteTableAssociation
}