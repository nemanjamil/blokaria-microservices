"use strict";
//const os = require("os");
require("dotenv").config();

// const tracer = require("dd-trace").init({
// 	service: "moleculerservice",
// 	url: "http://datadog-agent:8126",
// 	debug: true,
// 	samplingPriority: "USER_KEEP",
// 	logInjection: true,
// 	env: "testNet",
// });


// tracer.use("http");
// tracer.use("ioredis");
// tracer.use("moleculerservice", {
// 	params: true,
// });

/**
 * Moleculer ServiceBroker configuration file
 *
 * More info about options:
 *     https://moleculer.services/docs/0.14/configuration.html
 *
 *
 * Overwriting options in production:
 * ================================
 * 	You can overwrite any option with environment variables.
 * 	For example to overwrite the "logLevel" value, use `LOGLEVEL=warn` env var.
 * 	To overwrite a nested parameter, e.g. retryPolicy.retries, use `RETRYPOLICY_RETRIES=10` env var.
 *
 * 	To overwrite broker’s deeply nested default options, which are not presented in "moleculer.config.js",
 * 	use the `MOL_` prefix and double underscore `__` for nested properties in .env file.
 * 	For example, to set the cacher prefix to `MYCACHE`, you should declare an env var as `MOL_CACHER__OPTIONS__PREFIX=mycache`.
 *  It will set this:
 *  {
 *    cacher: {
 *      options: {
 *        prefix: "mycache"
 *      }
 *    }
 *  }
 */
module.exports = {
	// Namespace of nodes to segment your nodes on the same network.
	namespace: "BlokariaNameSpace",
	// Unique node identifier. Must be unique in a namespace.
	nodeID: "nemanja123",
	// Custom metadata store. Store here what you want. Accessing: `this.broker.metadata`

	// Enable/disable logging or use custom logger. More info: https://moleculer.services/docs/0.14/logging.html
	// Available logger types: "Console", "File", "Pino", "Winston", "Bunyan", "debug", "Log4js", "Datadog"
	logger: [
		{
			type: "Datadog",
			options: {
				// Logging level
				level: "info",

				// Datadog server endpoint. https://docs.datadoghq.com/api/?lang=bash#send-logs-over-http

				url: "https://http-intake.logs.datadoghq.eu/v1/input/",
				apiKey: process.env.DATADOG_API_KEY,

				// Datadog source variable
				ddSource: "moleculer-source-logger",

				// Datadog env variable
				env: "testnet-moleculer",
				version: "1.0.0",
				service: "moleculer-service",

				// Datadog hostname variable
				hostname: "peradetlic",
				// Custom object printer function for `Object` & `Ąrray`
				objectPrinter: null,
				// Data uploading interval
				interval: 10 * 1000
			}
		},
		// {
		// 	type: "Console",
		// 	options: {
		// 		level: "info",
		// 		// Using colors on the output
		// 		colors: true,
		// 		// Print module names with different colors (like docker-compose for containers)
		// 		moduleColors: false,
		// 		// Line formatter. It can be "json", "short", "simple", "full", a `Function` or a template string like "{timestamp} {level} {nodeID}/{mod}: {msg}"
		// 		formatter: "simple",
		// 		// Custom object printer. If not defined, it uses the `util.inspect` method.
		// 		objectPrinter: null,
		// 		// Auto-padding the module name in order to messages begin at the same column.
		// 		autoPadding: false,
		// 	}
		// }
	],
	/* logger: {
		type: "Console",
		options: {
			level: "info",
			// Using colors on the output
			colors: true,
			// Print module names with different colors (like docker-compose for containers)
			moduleColors: false,
			// Line formatter. It can be "json", "short", "simple", "full", a `Function` or a template string like "{timestamp} {level} {nodeID}/{mod}: {msg}"
			formatter: "simple",
			// Custom object printer. If not defined, it uses the `util.inspect` method.
			objectPrinter: null,
			// Auto-padding the module name in order to messages begin at the same column.
			autoPadding: false,
		},
	}, */
	// Default log level for built-in console logger. It can be overwritten in logger options above.
	// Available values: trace, debug, info, warn, error, fatal
	logLevel: "info",

	// Define transporter.
	// More info: https://moleculer.services/docs/0.14/networking.html
	// Note: During the development, you don't need to define it because all services will be loaded locally.
	// In production you can set it via `TRANSPORTER=nats://localhost:4222` environment variable.
	transporter: null,

	// Define a cacher.
	// More info: https://moleculer.services/docs/0.14/caching.html
	cacher: null,

	// Define a serializer.
	// Available values: "JSON", "Avro", "ProtoBuf", "MsgPack", "Notepack", "Thrift".
	// More info: https://moleculer.services/docs/0.14/networking.html#Serialization
	serializer: "JSON",

	// Number of milliseconds to wait before reject a request with a RequestTimeout error. Disabled: 0
	requestTimeout: 200 * 1000,

	// Retry policy settings. More info: https://moleculer.services/docs/0.14/fault-tolerance.html#Retry
	retryPolicy: {
		// Enable feature
		enabled: false,
		// Count of retries
		retries: 5,
		// First delay in milliseconds.
		delay: 100,
		// Maximum delay in milliseconds.
		maxDelay: 1000,
		// Backoff factor for delay. 2 means exponential backoff.
		factor: 2,
		// A function to check failed requests.
		check: (err) => err && !!err.retryable,
	},

	// Limit of calling level. If it reaches the limit, broker will throw an MaxCallLevelError error. (Infinite loop protection)
	maxCallLevel: 100,

	// Number of seconds to send heartbeat packet to other nodes.
	heartbeatInterval: 10,
	// Number of seconds to wait before setting node to unavailable status.
	heartbeatTimeout: 30,

	// Cloning the params of context if enabled. High performance impact, use it with caution!
	contextParamsCloning: false,

	// Tracking requests and waiting for running requests before shuting down. More info: https://moleculer.services/docs/0.14/context.html#Context-tracking
	tracking: {
		// Enable feature
		enabled: false,
		// Number of milliseconds to wait before shuting down the process.
		shutdownTimeout: 5000,
	},

	// Disable built-in request & emit balancer. (Transporter must support it, as well.). More info: https://moleculer.services/docs/0.14/networking.html#Disabled-balancer
	disableBalancer: false,

	// Settings of Service Registry. More info: https://moleculer.services/docs/0.14/registry.html
	registry: {
		// Define balancing strategy. More info: https://moleculer.services/docs/0.14/balancing.html
		// Available values: "RoundRobin", "Random", "CpuUsage", "Latency", "Shard"
		strategy: "RoundRobin",
		// Enable local action call preferring. Always call the local action instance if available.
		preferLocal: true,
	},

	// Settings of Circuit Breaker. More info: https://moleculer.services/docs/0.14/fault-tolerance.html#Circuit-Breaker
	circuitBreaker: {
		// Enable feature
		enabled: false,
		// Threshold value. 0.5 means that 50% should be failed for tripping.
		threshold: 0.5,
		// Minimum request count. Below it, CB does not trip.
		minRequestCount: 20,
		// Number of seconds for time window.
		windowTime: 60,
		// Number of milliseconds to switch from open to half-open state
		halfOpenTime: 10 * 1000,
		// A function to check failed requests.
		check: (err) => err && err.code >= 500,
	},

	// Settings of bulkhead feature. More info: https://moleculer.services/docs/0.14/fault-tolerance.html#Bulkhead
	bulkhead: {
		// Enable feature.
		enabled: false,
		// Maximum concurrent executions.
		concurrency: 10,
		// Maximum size of queue
		maxQueueSize: 100,
	},

	// Enable action & event parameter validation. More info: https://moleculer.services/docs/0.14/validating.html
	validator: true,

	errorHandler: null,

	// Enable/disable built-in metrics function. More info: https://moleculer.services/docs/0.14/metrics.html
	metrics: {
		enabled: true,
		// Available built-in reporters: "Console", "CSV", "Event", "Prometheus", "Datadog", "StatsD"
		reporter: [
			{
				type: "Datadog",
				options: {
					// Hostname
					host: "peradetlic",
					// Base URL
					baseUrl: "https://api.datadoghq.eu/api/",
					// API version
					apiVersion: "v1",
					// Server URL path
					path: "/series",
					// Datadog API Key
					apiKey: process.env.DATADOG_API_KEY,
					// Default labels which are appended to all metrics labels
					defaultLabels: (registry) => ({
						namespace: registry.broker.namespace,
						nodeID: registry.broker.nodeID
					}),
					// Sending interval in seconds
					interval: 10
				}
			}
		]
		// reporter: {
		// 	type: "Prometheus",
		// 	options: {
		// 		// HTTP port
		// 		port: 3032,
		// 		// HTTP URL path
		// 		path: "/metrics",
		// 		// Default labels which are appended to all metrics labels
		// 		defaultLabels: (registry) => ({
		// 			namespace: registry.broker.namespace,
		// 			nodeID: registry.broker.nodeID,
		// 		}),
		// 	},
		// },
	},

	// Enable built-in tracing function. More info: https://moleculer.services/docs/0.14/tracing.html
	tracing: {
		enabled: true,
		// Available built-in exporters: "Console", "Datadog", "Event", "EventLegacy", "Jaeger", "Zipkin"
		exporter: [
			{
				type: "Datadog",
				options: {
					//tracer
					agentUrl: "http://datadog-agent-on-docker:8126",
					// Environment variable
					env: "testnet-moleculer",
					// Sampling priority. More info: https://docs.datadoghq.com/tracing/guide/trace_sampling_and_storage/?tab=java#sampling-rules
					samplingPriority: "AUTO_KEEP",
					// Default tags. They will be added into all span tags.
					defaultTags: { "tracingTag1": "tag1", "tracingTag2": "tag2" },

					// Custom Datadog Tracer options. More info: https://datadog.github.io/dd-trace-js/#tracer-settings
					tracerOptions: {
						"hostname": "datadog-agent-on-docker",
						"service": "moleculer-service",
						"version": "1.0.0", // The version number of the application. Defaults to value of the version field in package.json.
						"logInjection": "true",
					},
				}
			},
			// {
			// 	type: "Console", // Console exporter is only for development!
			// 	options: {
			// 		// Custom logger
			// 		logger: null,
			// 		// Using colors
			// 		colors: true,
			// 		// Width of row
			// 		width: 100,
			// 		// Gauge width in the row
			// 		gaugeWidth: 40,
			// 	},
			// }
		],
	},

	// Register custom middlewares
	middlewares: [],

	// Register custom REPL commands.
	replCommands: null,

	// Called after broker created.
	created(broker) {

	},

	// Called after broker started.
	async started(broker) {

	},

	// Called after broker stopped.
	async stopped(broker) {

	}
};
