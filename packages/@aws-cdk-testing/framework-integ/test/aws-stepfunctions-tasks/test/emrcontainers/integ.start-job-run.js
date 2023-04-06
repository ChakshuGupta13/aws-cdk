"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ec2 = require("aws-cdk-lib/aws-ec2");
const eks = require("aws-cdk-lib/aws-eks");
const iam = require("aws-cdk-lib/aws-iam");
const sfn = require("aws-cdk-lib/aws-stepfunctions");
const cdk = require("aws-cdk-lib");
const aws_cdk_lib_1 = require("aws-cdk-lib");
const integ = require("@aws-cdk/integ-tests-alpha");
const aws_stepfunctions_tasks_1 = require("aws-cdk-lib/aws-stepfunctions-tasks");
/**
 * Stack verification steps:
 * Everything in the link below must be setup before running the state machine.
 * @see https://docs.aws.amazon.com/emr/latest/EMR-on-EKS-DevelopmentGuide/setting-up-enable-IAM.html
 * aws stepfunctions start-execution --state-machine-arn <deployed state machine arn> : should return execution arn
 * aws stepfunctions describe-execution --execution-arn <exection-arn generated before> : should return status as SUCCEEDED
 */
const app = new cdk.App();
const stack = new cdk.Stack(app, 'aws-stepfunctions-tasks-emr-containers-start-job-run-test');
const eksCluster = new eks.Cluster(stack, 'integration-test-eks-cluster', {
    version: eks.KubernetesVersion.V1_21,
    defaultCapacity: 3,
    defaultCapacityInstance: ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.XLARGE),
});
const virtualCluster = new cdk.CfnResource(stack, 'Virtual Cluster', {
    type: 'AWS::EMRContainers::VirtualCluster',
    properties: {
        ContainerProvider: {
            Id: eksCluster.clusterName,
            Info: {
                EksInfo: {
                    Namespace: 'default',
                },
            },
            Type: 'EKS',
        },
        Name: 'Virtual-Cluster-Name',
    },
});
const emrRole = eksCluster.addManifest('emrRole', {
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'Role',
    metadata: { name: 'emr-containers', namespace: 'default' },
    rules: [
        { apiGroups: [''], resources: ['namespaces'], verbs: ['get'] },
        { apiGroups: [''], resources: ['serviceaccounts', 'services', 'configmaps', 'events', 'pods', 'pods/log'], verbs: ['get', 'list', 'watch', 'describe', 'create', 'edit', 'delete', 'deletecollection', 'annotate', 'patch', 'label'] },
        { apiGroups: [''], resources: ['secrets'], verbs: ['create', 'patch', 'delete', 'watch'] },
        { apiGroups: ['apps'], resources: ['statefulsets', 'deployments'], verbs: ['get', 'list', 'watch', 'describe', 'create', 'edit', 'delete', 'annotate', 'patch', 'label'] },
        { apiGroups: ['batch'], resources: ['jobs'], verbs: ['get', 'list', 'watch', 'describe', 'create', 'edit', 'delete', 'annotate', 'patch', 'label'] },
        { apiGroups: ['extensions'], resources: ['ingresses'], verbs: ['get', 'list', 'watch', 'describe', 'create', 'edit', 'delete', 'annotate', 'patch', 'label'] },
        { apiGroups: ['rbac.authorization.k8s.io'], resources: ['roles', 'rolebindings'], verbs: ['get', 'list', 'watch', 'describe', 'create', 'edit', 'delete', 'deletecollection', 'annotate', 'patch', 'label'] },
    ],
});
const emrRoleBind = eksCluster.addManifest('emrRoleBind', {
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'RoleBinding',
    metadata: { name: 'emr-containers', namespace: 'default' },
    subjects: [{ kind: 'User', name: 'emr-containers', apiGroup: 'rbac.authorization.k8s.io' }],
    roleRef: { kind: 'Role', name: 'emr-containers', apiGroup: 'rbac.authorization.k8s.io' },
});
emrRoleBind.node.addDependency(emrRole);
const emrServiceRole = iam.Role.fromRoleArn(stack, 'emrServiceRole', 'arn:aws:iam::' + aws_cdk_lib_1.Aws.ACCOUNT_ID + ':role/AWSServiceRoleForAmazonEMRContainers');
const authMapping = { groups: [], username: 'emr-containers' };
eksCluster.awsAuth.addRoleMapping(emrServiceRole, authMapping);
virtualCluster.node.addDependency(emrRoleBind);
virtualCluster.node.addDependency(eksCluster.awsAuth);
const startJobRunJob = new aws_stepfunctions_tasks_1.EmrContainersStartJobRun(stack, 'Start a Job Run', {
    virtualCluster: aws_stepfunctions_tasks_1.VirtualClusterInput.fromVirtualClusterId(virtualCluster.getAtt('Id').toString()),
    releaseLabel: aws_stepfunctions_tasks_1.ReleaseLabel.EMR_6_2_0,
    jobName: 'EMR-Containers-Job',
    jobDriver: {
        sparkSubmitJobDriver: {
            entryPoint: sfn.TaskInput.fromText('local:///usr/lib/spark/examples/src/main/python/pi.py'),
            entryPointArguments: sfn.TaskInput.fromObject(['2']),
            sparkSubmitParameters: '--conf spark.driver.memory=512M --conf spark.kubernetes.driver.request.cores=0.2 --conf spark.kubernetes.executor.request.cores=0.2 --conf spark.sql.shuffle.partitions=60 --conf spark.dynamicAllocation.enabled=false',
        },
    },
});
const chain = sfn.Chain.start(startJobRunJob);
const sm = new sfn.StateMachine(stack, 'StateMachine', {
    definition: chain,
    timeout: cdk.Duration.seconds(1000),
});
new cdk.CfnOutput(stack, 'stateMachineArn', {
    value: sm.stateMachineArn,
});
new integ.IntegTest(app, 'aws-stepfunctions-tasks-emr-containers-start-job-run', {
    testCases: [stack],
    cdkCommandOptions: {
        deploy: {
            args: {
                rollback: true,
            },
        },
    },
});
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZWcuc3RhcnQtam9iLXJ1bi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImludGVnLnN0YXJ0LWpvYi1ydW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSwyQ0FBMkM7QUFDM0MsMkNBQTJDO0FBRTNDLDJDQUEyQztBQUMzQyxxREFBcUQ7QUFDckQsbUNBQW1DO0FBQ25DLDZDQUFrQztBQUNsQyxvREFBb0Q7QUFDcEQsaUZBQWtIO0FBRWxIOzs7Ozs7R0FNRztBQUVILE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBQzFCLE1BQU0sS0FBSyxHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsMkRBQTJELENBQUMsQ0FBQztBQUU5RixNQUFNLFVBQVUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLDhCQUE4QixFQUFFO0lBQ3hFLE9BQU8sRUFBRSxHQUFHLENBQUMsaUJBQWlCLENBQUMsS0FBSztJQUNwQyxlQUFlLEVBQUUsQ0FBQztJQUNsQix1QkFBdUIsRUFBRSxHQUFHLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQztDQUM1RixDQUFDLENBQUM7QUFFSCxNQUFNLGNBQWMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFLGlCQUFpQixFQUFFO0lBQ25FLElBQUksRUFBRSxvQ0FBb0M7SUFDMUMsVUFBVSxFQUFFO1FBQ1YsaUJBQWlCLEVBQUU7WUFDakIsRUFBRSxFQUFFLFVBQVUsQ0FBQyxXQUFXO1lBQzFCLElBQUksRUFBRTtnQkFDSixPQUFPLEVBQUU7b0JBQ1AsU0FBUyxFQUFFLFNBQVM7aUJBQ3JCO2FBQ0Y7WUFDRCxJQUFJLEVBQUUsS0FBSztTQUNaO1FBQ0QsSUFBSSxFQUFFLHNCQUFzQjtLQUM3QjtDQUNGLENBQUMsQ0FBQztBQUVILE1BQU0sT0FBTyxHQUFHLFVBQVUsQ0FBQyxXQUFXLENBQUMsU0FBUyxFQUFFO0lBQ2hELFVBQVUsRUFBRSw4QkFBOEI7SUFDMUMsSUFBSSxFQUFFLE1BQU07SUFDWixRQUFRLEVBQUUsRUFBRSxJQUFJLEVBQUUsZ0JBQWdCLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRTtJQUMxRCxLQUFLLEVBQUU7UUFDTCxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRSxDQUFDLFlBQVksQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLEtBQUssQ0FBQyxFQUFFO1FBQzlELEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLENBQUMsaUJBQWlCLEVBQUUsVUFBVSxFQUFFLFlBQVksRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLFVBQVUsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxrQkFBa0IsRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFFLE9BQU8sQ0FBQyxFQUFFO1FBQ3RPLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLENBQUMsU0FBUyxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUMsUUFBUSxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsT0FBTyxDQUFDLEVBQUU7UUFDMUYsRUFBRSxTQUFTLEVBQUUsQ0FBQyxNQUFNLENBQUMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxjQUFjLEVBQUUsYUFBYSxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsVUFBVSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRSxPQUFPLEVBQUUsT0FBTyxDQUFDLEVBQUU7UUFDMUssRUFBRSxTQUFTLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxNQUFNLENBQUMsRUFBRSxLQUFLLEVBQUUsQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxVQUFVLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBRSxPQUFPLENBQUMsRUFBRTtRQUNwSixFQUFFLFNBQVMsRUFBRSxDQUFDLFlBQVksQ0FBQyxFQUFFLFNBQVMsRUFBRSxDQUFDLFdBQVcsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFFLE9BQU8sQ0FBQyxFQUFFO1FBQzlKLEVBQUUsU0FBUyxFQUFFLENBQUMsMkJBQTJCLENBQUMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxPQUFPLEVBQUUsY0FBYyxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsVUFBVSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLGtCQUFrQixFQUFFLFVBQVUsRUFBRSxPQUFPLEVBQUUsT0FBTyxDQUFDLEVBQUU7S0FDOU07Q0FDRixDQUFDLENBQUM7QUFFSCxNQUFNLFdBQVcsR0FBRyxVQUFVLENBQUMsV0FBVyxDQUFDLGFBQWEsRUFBRTtJQUN4RCxVQUFVLEVBQUUsOEJBQThCO0lBQzFDLElBQUksRUFBRSxhQUFhO0lBQ25CLFFBQVEsRUFBRSxFQUFFLElBQUksRUFBRSxnQkFBZ0IsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFO0lBQzFELFFBQVEsRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsZ0JBQWdCLEVBQUUsUUFBUSxFQUFFLDJCQUEyQixFQUFFLENBQUM7SUFDM0YsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsZ0JBQWdCLEVBQUUsUUFBUSxFQUFFLDJCQUEyQixFQUFFO0NBQ3pGLENBQUMsQ0FBQztBQUVILFdBQVcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBRXhDLE1BQU0sY0FBYyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRSxnQkFBZ0IsRUFBRSxlQUFlLEdBQUMsaUJBQUcsQ0FBQyxVQUFVLEdBQUMsNENBQTRDLENBQUMsQ0FBQztBQUNsSixNQUFNLFdBQVcsR0FBbUIsRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFLFFBQVEsRUFBRSxnQkFBZ0IsRUFBRSxDQUFDO0FBQy9FLFVBQVUsQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLGNBQWMsRUFBRSxXQUFXLENBQUMsQ0FBQztBQUUvRCxjQUFjLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUMvQyxjQUFjLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUM7QUFFdEQsTUFBTSxjQUFjLEdBQUcsSUFBSSxrREFBd0IsQ0FBQyxLQUFLLEVBQUUsaUJBQWlCLEVBQUU7SUFDNUUsY0FBYyxFQUFFLDZDQUFtQixDQUFDLG9CQUFvQixDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDaEcsWUFBWSxFQUFFLHNDQUFZLENBQUMsU0FBUztJQUNwQyxPQUFPLEVBQUUsb0JBQW9CO0lBQzdCLFNBQVMsRUFBRTtRQUNULG9CQUFvQixFQUFFO1lBQ3BCLFVBQVUsRUFBRSxHQUFHLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyx1REFBdUQsQ0FBQztZQUMzRixtQkFBbUIsRUFBRSxHQUFHLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ3BELHFCQUFxQixFQUFFLHlOQUF5TjtTQUNqUDtLQUNGO0NBQ0YsQ0FBQyxDQUFDO0FBRUgsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUM7QUFFOUMsTUFBTSxFQUFFLEdBQUcsSUFBSSxHQUFHLENBQUMsWUFBWSxDQUFDLEtBQUssRUFBRSxjQUFjLEVBQUU7SUFDckQsVUFBVSxFQUFFLEtBQUs7SUFDakIsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztDQUNwQyxDQUFDLENBQUM7QUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLGlCQUFpQixFQUFFO0lBQzFDLEtBQUssRUFBRSxFQUFFLENBQUMsZUFBZTtDQUMxQixDQUFDLENBQUM7QUFFSCxJQUFJLEtBQUssQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFLHNEQUFzRCxFQUFFO0lBQy9FLFNBQVMsRUFBRSxDQUFDLEtBQUssQ0FBQztJQUNsQixpQkFBaUIsRUFBRTtRQUNqQixNQUFNLEVBQUU7WUFDTixJQUFJLEVBQUU7Z0JBQ0osUUFBUSxFQUFFLElBQUk7YUFDZjtTQUNGO0tBQ0Y7Q0FDRixDQUFDLENBQUM7QUFFSCxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XG5pbXBvcnQgKiBhcyBla3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVrcyc7XG5pbXBvcnQgeyBBd3NBdXRoTWFwcGluZyB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1la3MnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgc2ZuIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zdGVwZnVuY3Rpb25zJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBBd3MgfSBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBpbnRlZyBmcm9tICdAYXdzLWNkay9pbnRlZy10ZXN0cy1hbHBoYSc7XG5pbXBvcnQgeyBFbXJDb250YWluZXJzU3RhcnRKb2JSdW4sIFJlbGVhc2VMYWJlbCwgVmlydHVhbENsdXN0ZXJJbnB1dCB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1zdGVwZnVuY3Rpb25zLXRhc2tzJztcblxuLyoqXG4gKiBTdGFjayB2ZXJpZmljYXRpb24gc3RlcHM6XG4gKiBFdmVyeXRoaW5nIGluIHRoZSBsaW5rIGJlbG93IG11c3QgYmUgc2V0dXAgYmVmb3JlIHJ1bm5pbmcgdGhlIHN0YXRlIG1hY2hpbmUuXG4gKiBAc2VlIGh0dHBzOi8vZG9jcy5hd3MuYW1hem9uLmNvbS9lbXIvbGF0ZXN0L0VNUi1vbi1FS1MtRGV2ZWxvcG1lbnRHdWlkZS9zZXR0aW5nLXVwLWVuYWJsZS1JQU0uaHRtbFxuICogYXdzIHN0ZXBmdW5jdGlvbnMgc3RhcnQtZXhlY3V0aW9uIC0tc3RhdGUtbWFjaGluZS1hcm4gPGRlcGxveWVkIHN0YXRlIG1hY2hpbmUgYXJuPiA6IHNob3VsZCByZXR1cm4gZXhlY3V0aW9uIGFyblxuICogYXdzIHN0ZXBmdW5jdGlvbnMgZGVzY3JpYmUtZXhlY3V0aW9uIC0tZXhlY3V0aW9uLWFybiA8ZXhlY3Rpb24tYXJuIGdlbmVyYXRlZCBiZWZvcmU+IDogc2hvdWxkIHJldHVybiBzdGF0dXMgYXMgU1VDQ0VFREVEXG4gKi9cblxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcbmNvbnN0IHN0YWNrID0gbmV3IGNkay5TdGFjayhhcHAsICdhd3Mtc3RlcGZ1bmN0aW9ucy10YXNrcy1lbXItY29udGFpbmVycy1zdGFydC1qb2ItcnVuLXRlc3QnKTtcblxuY29uc3QgZWtzQ2x1c3RlciA9IG5ldyBla3MuQ2x1c3RlcihzdGFjaywgJ2ludGVncmF0aW9uLXRlc3QtZWtzLWNsdXN0ZXInLCB7XG4gIHZlcnNpb246IGVrcy5LdWJlcm5ldGVzVmVyc2lvbi5WMV8yMSxcbiAgZGVmYXVsdENhcGFjaXR5OiAzLFxuICBkZWZhdWx0Q2FwYWNpdHlJbnN0YW5jZTogZWMyLkluc3RhbmNlVHlwZS5vZihlYzIuSW5zdGFuY2VDbGFzcy5NNSwgZWMyLkluc3RhbmNlU2l6ZS5YTEFSR0UpLFxufSk7XG5cbmNvbnN0IHZpcnR1YWxDbHVzdGVyID0gbmV3IGNkay5DZm5SZXNvdXJjZShzdGFjaywgJ1ZpcnR1YWwgQ2x1c3RlcicsIHtcbiAgdHlwZTogJ0FXUzo6RU1SQ29udGFpbmVyczo6VmlydHVhbENsdXN0ZXInLFxuICBwcm9wZXJ0aWVzOiB7XG4gICAgQ29udGFpbmVyUHJvdmlkZXI6IHtcbiAgICAgIElkOiBla3NDbHVzdGVyLmNsdXN0ZXJOYW1lLFxuICAgICAgSW5mbzoge1xuICAgICAgICBFa3NJbmZvOiB7XG4gICAgICAgICAgTmFtZXNwYWNlOiAnZGVmYXVsdCcsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgVHlwZTogJ0VLUycsXG4gICAgfSxcbiAgICBOYW1lOiAnVmlydHVhbC1DbHVzdGVyLU5hbWUnLFxuICB9LFxufSk7XG5cbmNvbnN0IGVtclJvbGUgPSBla3NDbHVzdGVyLmFkZE1hbmlmZXN0KCdlbXJSb2xlJywge1xuICBhcGlWZXJzaW9uOiAncmJhYy5hdXRob3JpemF0aW9uLms4cy5pby92MScsXG4gIGtpbmQ6ICdSb2xlJyxcbiAgbWV0YWRhdGE6IHsgbmFtZTogJ2Vtci1jb250YWluZXJzJywgbmFtZXNwYWNlOiAnZGVmYXVsdCcgfSxcbiAgcnVsZXM6IFtcbiAgICB7IGFwaUdyb3VwczogWycnXSwgcmVzb3VyY2VzOiBbJ25hbWVzcGFjZXMnXSwgdmVyYnM6IFsnZ2V0J10gfSxcbiAgICB7IGFwaUdyb3VwczogWycnXSwgcmVzb3VyY2VzOiBbJ3NlcnZpY2VhY2NvdW50cycsICdzZXJ2aWNlcycsICdjb25maWdtYXBzJywgJ2V2ZW50cycsICdwb2RzJywgJ3BvZHMvbG9nJ10sIHZlcmJzOiBbJ2dldCcsICdsaXN0JywgJ3dhdGNoJywgJ2Rlc2NyaWJlJywgJ2NyZWF0ZScsICdlZGl0JywgJ2RlbGV0ZScsICdkZWxldGVjb2xsZWN0aW9uJywgJ2Fubm90YXRlJywgJ3BhdGNoJywgJ2xhYmVsJ10gfSxcbiAgICB7IGFwaUdyb3VwczogWycnXSwgcmVzb3VyY2VzOiBbJ3NlY3JldHMnXSwgdmVyYnM6IFsnY3JlYXRlJywgJ3BhdGNoJywgJ2RlbGV0ZScsICd3YXRjaCddIH0sXG4gICAgeyBhcGlHcm91cHM6IFsnYXBwcyddLCByZXNvdXJjZXM6IFsnc3RhdGVmdWxzZXRzJywgJ2RlcGxveW1lbnRzJ10sIHZlcmJzOiBbJ2dldCcsICdsaXN0JywgJ3dhdGNoJywgJ2Rlc2NyaWJlJywgJ2NyZWF0ZScsICdlZGl0JywgJ2RlbGV0ZScsICdhbm5vdGF0ZScsICdwYXRjaCcsICdsYWJlbCddIH0sXG4gICAgeyBhcGlHcm91cHM6IFsnYmF0Y2gnXSwgcmVzb3VyY2VzOiBbJ2pvYnMnXSwgdmVyYnM6IFsnZ2V0JywgJ2xpc3QnLCAnd2F0Y2gnLCAnZGVzY3JpYmUnLCAnY3JlYXRlJywgJ2VkaXQnLCAnZGVsZXRlJywgJ2Fubm90YXRlJywgJ3BhdGNoJywgJ2xhYmVsJ10gfSxcbiAgICB7IGFwaUdyb3VwczogWydleHRlbnNpb25zJ10sIHJlc291cmNlczogWydpbmdyZXNzZXMnXSwgdmVyYnM6IFsnZ2V0JywgJ2xpc3QnLCAnd2F0Y2gnLCAnZGVzY3JpYmUnLCAnY3JlYXRlJywgJ2VkaXQnLCAnZGVsZXRlJywgJ2Fubm90YXRlJywgJ3BhdGNoJywgJ2xhYmVsJ10gfSxcbiAgICB7IGFwaUdyb3VwczogWydyYmFjLmF1dGhvcml6YXRpb24uazhzLmlvJ10sIHJlc291cmNlczogWydyb2xlcycsICdyb2xlYmluZGluZ3MnXSwgdmVyYnM6IFsnZ2V0JywgJ2xpc3QnLCAnd2F0Y2gnLCAnZGVzY3JpYmUnLCAnY3JlYXRlJywgJ2VkaXQnLCAnZGVsZXRlJywgJ2RlbGV0ZWNvbGxlY3Rpb24nLCAnYW5ub3RhdGUnLCAncGF0Y2gnLCAnbGFiZWwnXSB9LFxuICBdLFxufSk7XG5cbmNvbnN0IGVtclJvbGVCaW5kID0gZWtzQ2x1c3Rlci5hZGRNYW5pZmVzdCgnZW1yUm9sZUJpbmQnLCB7XG4gIGFwaVZlcnNpb246ICdyYmFjLmF1dGhvcml6YXRpb24uazhzLmlvL3YxJyxcbiAga2luZDogJ1JvbGVCaW5kaW5nJyxcbiAgbWV0YWRhdGE6IHsgbmFtZTogJ2Vtci1jb250YWluZXJzJywgbmFtZXNwYWNlOiAnZGVmYXVsdCcgfSxcbiAgc3ViamVjdHM6IFt7IGtpbmQ6ICdVc2VyJywgbmFtZTogJ2Vtci1jb250YWluZXJzJywgYXBpR3JvdXA6ICdyYmFjLmF1dGhvcml6YXRpb24uazhzLmlvJyB9XSxcbiAgcm9sZVJlZjogeyBraW5kOiAnUm9sZScsIG5hbWU6ICdlbXItY29udGFpbmVycycsIGFwaUdyb3VwOiAncmJhYy5hdXRob3JpemF0aW9uLms4cy5pbycgfSxcbn0pO1xuXG5lbXJSb2xlQmluZC5ub2RlLmFkZERlcGVuZGVuY3koZW1yUm9sZSk7XG5cbmNvbnN0IGVtclNlcnZpY2VSb2xlID0gaWFtLlJvbGUuZnJvbVJvbGVBcm4oc3RhY2ssICdlbXJTZXJ2aWNlUm9sZScsICdhcm46YXdzOmlhbTo6JytBd3MuQUNDT1VOVF9JRCsnOnJvbGUvQVdTU2VydmljZVJvbGVGb3JBbWF6b25FTVJDb250YWluZXJzJyk7XG5jb25zdCBhdXRoTWFwcGluZzogQXdzQXV0aE1hcHBpbmcgPSB7IGdyb3VwczogW10sIHVzZXJuYW1lOiAnZW1yLWNvbnRhaW5lcnMnIH07XG5la3NDbHVzdGVyLmF3c0F1dGguYWRkUm9sZU1hcHBpbmcoZW1yU2VydmljZVJvbGUsIGF1dGhNYXBwaW5nKTtcblxudmlydHVhbENsdXN0ZXIubm9kZS5hZGREZXBlbmRlbmN5KGVtclJvbGVCaW5kKTtcbnZpcnR1YWxDbHVzdGVyLm5vZGUuYWRkRGVwZW5kZW5jeShla3NDbHVzdGVyLmF3c0F1dGgpO1xuXG5jb25zdCBzdGFydEpvYlJ1bkpvYiA9IG5ldyBFbXJDb250YWluZXJzU3RhcnRKb2JSdW4oc3RhY2ssICdTdGFydCBhIEpvYiBSdW4nLCB7XG4gIHZpcnR1YWxDbHVzdGVyOiBWaXJ0dWFsQ2x1c3RlcklucHV0LmZyb21WaXJ0dWFsQ2x1c3RlcklkKHZpcnR1YWxDbHVzdGVyLmdldEF0dCgnSWQnKS50b1N0cmluZygpKSxcbiAgcmVsZWFzZUxhYmVsOiBSZWxlYXNlTGFiZWwuRU1SXzZfMl8wLFxuICBqb2JOYW1lOiAnRU1SLUNvbnRhaW5lcnMtSm9iJyxcbiAgam9iRHJpdmVyOiB7XG4gICAgc3BhcmtTdWJtaXRKb2JEcml2ZXI6IHtcbiAgICAgIGVudHJ5UG9pbnQ6IHNmbi5UYXNrSW5wdXQuZnJvbVRleHQoJ2xvY2FsOi8vL3Vzci9saWIvc3BhcmsvZXhhbXBsZXMvc3JjL21haW4vcHl0aG9uL3BpLnB5JyksXG4gICAgICBlbnRyeVBvaW50QXJndW1lbnRzOiBzZm4uVGFza0lucHV0LmZyb21PYmplY3QoWycyJ10pLFxuICAgICAgc3BhcmtTdWJtaXRQYXJhbWV0ZXJzOiAnLS1jb25mIHNwYXJrLmRyaXZlci5tZW1vcnk9NTEyTSAtLWNvbmYgc3Bhcmsua3ViZXJuZXRlcy5kcml2ZXIucmVxdWVzdC5jb3Jlcz0wLjIgLS1jb25mIHNwYXJrLmt1YmVybmV0ZXMuZXhlY3V0b3IucmVxdWVzdC5jb3Jlcz0wLjIgLS1jb25mIHNwYXJrLnNxbC5zaHVmZmxlLnBhcnRpdGlvbnM9NjAgLS1jb25mIHNwYXJrLmR5bmFtaWNBbGxvY2F0aW9uLmVuYWJsZWQ9ZmFsc2UnLFxuICAgIH0sXG4gIH0sXG59KTtcblxuY29uc3QgY2hhaW4gPSBzZm4uQ2hhaW4uc3RhcnQoc3RhcnRKb2JSdW5Kb2IpO1xuXG5jb25zdCBzbSA9IG5ldyBzZm4uU3RhdGVNYWNoaW5lKHN0YWNrLCAnU3RhdGVNYWNoaW5lJywge1xuICBkZWZpbml0aW9uOiBjaGFpbixcbiAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTAwMCksXG59KTtcblxubmV3IGNkay5DZm5PdXRwdXQoc3RhY2ssICdzdGF0ZU1hY2hpbmVBcm4nLCB7XG4gIHZhbHVlOiBzbS5zdGF0ZU1hY2hpbmVBcm4sXG59KTtcblxubmV3IGludGVnLkludGVnVGVzdChhcHAsICdhd3Mtc3RlcGZ1bmN0aW9ucy10YXNrcy1lbXItY29udGFpbmVycy1zdGFydC1qb2ItcnVuJywge1xuICB0ZXN0Q2FzZXM6IFtzdGFja10sXG4gIGNka0NvbW1hbmRPcHRpb25zOiB7XG4gICAgZGVwbG95OiB7XG4gICAgICBhcmdzOiB7XG4gICAgICAgIHJvbGxiYWNrOiB0cnVlLFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxufSk7XG5cbmFwcC5zeW50aCgpO1xuIl19