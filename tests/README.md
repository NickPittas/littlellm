# MCP Agentic Workflows Testing Guide

This comprehensive testing suite validates the enhanced MCP (Model Context Protocol) tool calling system with advanced multi-tool agentic capabilities.

## 🧪 Test Structure

### Test Categories

#### 1. **Unit Tests** (`agentic-workflows.test.ts`)
- **Purpose**: Test core components in isolation
- **Coverage**: Parallel execution, response aggregation, tool chaining analysis, error recovery
- **Timeout**: 5 seconds
- **Focus**: Individual method functionality and edge cases

#### 2. **Integration Tests** (`integration/workflow-integration.test.ts`)
- **Purpose**: End-to-end workflow testing across providers
- **Coverage**: Multi-provider compatibility, complete workflows, tool coordination
- **Timeout**: 10 seconds
- **Focus**: System integration and provider-specific behavior

#### 3. **Performance Tests** (`performance/workflow-benchmarks.test.ts`)
- **Purpose**: Measure and validate performance characteristics
- **Coverage**: Parallel vs sequential execution, scalability, memory usage
- **Timeout**: 15 seconds
- **Focus**: Performance optimization validation

#### 4. **Scenario Tests** (`scenarios/workflow-scenarios.test.ts`)
- **Purpose**: Real-world workflow simulation
- **Coverage**: Research workflows, content creation, data analysis
- **Timeout**: 10 seconds
- **Focus**: Practical use case validation

#### 5. **Stress Tests** (`stress/edge-cases.test.ts`)
- **Purpose**: System limits and failure handling
- **Coverage**: High failure rates, resource exhaustion, edge cases
- **Timeout**: 30 seconds
- **Focus**: Reliability under adverse conditions

## 🚀 Running Tests

### Quick Commands

```bash
# Run all tests
npm test

# Run specific test suite
npm run test:unit
npm run test:integration
npm run test:performance
npm run test:scenarios
npm run test:stress

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### Test Execution Strategies

#### Smoke Testing (Quick Validation)
```bash
npm run test:smoke
```
- Runs: Unit tests only
- Duration: ~30 seconds
- Purpose: Quick validation of core functionality

#### Standard Testing (CI/CD)
```bash
npm run test:standard
```
- Runs: Unit + Integration + Scenarios
- Duration: ~2-3 minutes
- Purpose: Comprehensive functionality validation

#### Full Testing (Complete Validation)
```bash
npm run test:full
```
- Runs: All test suites
- Duration: ~5-10 minutes
- Purpose: Complete system validation including performance

#### Performance Testing (Benchmarking)
```bash
npm run test:performance
```
- Runs: Performance + Stress tests
- Duration: ~3-5 minutes
- Purpose: Performance benchmarking and optimization validation

## 📊 Test Metrics and Expectations

### Performance Benchmarks

#### Parallel Execution Efficiency
- **Target**: 60-80% reduction in execution time vs sequential
- **Measurement**: Multiple tools executing concurrently
- **Threshold**: Must complete in <70% of sequential time

#### Scalability Limits
- **Concurrent Tools**: Up to 200 tools simultaneously
- **Memory Usage**: <100MB additional memory per workflow
- **Response Time**: <2 seconds for 50 concurrent tools

#### Error Recovery Performance
- **Recovery Rate**: >80% of failed tools should have alternatives attempted
- **Recovery Overhead**: <50% additional time for recovery attempts
- **Graceful Degradation**: System remains functional with 50% tool failure rate

### Reliability Metrics

#### Success Rates
- **Normal Conditions**: >95% tool execution success
- **High Failure Conditions**: >50% overall workflow completion
- **Recovery Scenarios**: >70% successful alternative tool usage

#### Resource Management
- **Memory Leaks**: No memory growth >10MB over baseline
- **Connection Pooling**: Efficient reuse of MCP connections
- **Timeout Handling**: Graceful handling of slow/unresponsive tools

## 🔧 Test Configuration

### Environment Setup

The test suite automatically configures:
- Mock Electron API for MCP communication
- Performance monitoring utilities
- Memory usage tracking
- Custom assertion helpers

### Mock Data Generation

Tests use realistic mock data:
- **Search Results**: Structured web search responses
- **Memory Data**: User preferences and stored information
- **Tool Responses**: Various success/failure scenarios
- **Large Datasets**: Memory and performance stress testing

### Custom Assertions

#### Workflow Validation
```typescript
expect(workflowResult).toBeValidWorkflowResult();
```

#### Performance Validation
```typescript
expect(executionTime).toHaveParallelPerformance(toolCount, baseTime);
```

#### Recovery Validation
```typescript
expect(results).toHaveSuccessfulRecovery(originalFailures);
```

## 📈 Performance Testing Details

### Parallel vs Sequential Comparison

Tests measure execution time for:
- 1, 5, 10, 20, 50 concurrent tools
- Various tool response times (fast, normal, slow)
- Mixed success/failure scenarios

**Expected Results**:
- 5 tools: ~100ms parallel vs ~500ms sequential
- 20 tools: ~200ms parallel vs ~2000ms sequential
- 50 tools: ~300ms parallel vs ~5000ms sequential

### Memory Usage Analysis

Monitors memory consumption during:
- Large tool argument payloads
- Extensive result aggregation
- Long-running workflows
- High concurrency scenarios

**Thresholds**:
- Base memory usage: <50MB
- Per-tool overhead: <1MB
- Result aggregation: <10MB additional
- Recovery operations: <20MB additional

### Scalability Testing

Validates system behavior with:
- Increasing tool counts (1 → 200)
- Growing result set sizes
- Extended workflow iterations
- Resource-intensive operations

## 🛠️ Debugging Test Failures

### Common Issues and Solutions

#### Test Timeouts
- **Cause**: Slow mock responses or infinite loops
- **Solution**: Check mock delay configurations and iteration limits
- **Debug**: Enable detailed logging with `DEBUG=true npm test`

#### Memory Issues
- **Cause**: Large mock data or memory leaks
- **Solution**: Reduce mock data size or check cleanup procedures
- **Debug**: Monitor memory usage with performance utilities

#### Assertion Failures
- **Cause**: Unexpected mock behavior or timing issues
- **Solution**: Verify mock configurations and add debugging logs
- **Debug**: Use `console.log` in test setup to trace execution

### Test Data Inspection

Enable detailed test output:
```bash
# Verbose test output
npm run test -- --reporter=verbose

# Performance metrics logging
PERFORMANCE_LOGGING=true npm run test:performance

# Workflow execution tracing
WORKFLOW_TRACING=true npm run test:scenarios
```

## 📋 Test Checklist

### Before Running Tests
- [ ] Ensure all dependencies are installed
- [ ] Verify test environment setup
- [ ] Check mock configurations
- [ ] Clear any cached test data

### After Test Completion
- [ ] Review test coverage reports
- [ ] Analyze performance metrics
- [ ] Check for memory leaks
- [ ] Validate error recovery scenarios

### Continuous Integration
- [ ] All unit tests pass
- [ ] Integration tests complete successfully
- [ ] Performance benchmarks meet thresholds
- [ ] No memory leaks detected
- [ ] Error recovery mechanisms functional

## 🎯 Test Coverage Goals

### Functional Coverage
- **Parallel Execution**: 100% of parallel execution paths
- **Tool Chaining**: 90% of chaining scenarios
- **Error Recovery**: 85% of failure/recovery combinations
- **Response Aggregation**: 95% of formatting scenarios

### Edge Case Coverage
- **Empty Inputs**: All methods handle empty/null inputs
- **Malformed Data**: Graceful handling of invalid data
- **Resource Limits**: Behavior under resource constraints
- **Timeout Scenarios**: Proper timeout handling

### Provider Coverage
- **OpenAI**: Complete workflow testing
- **Anthropic**: Tool calling and response handling
- **Ollama**: Native API integration
- **Mistral**: Two-call pattern validation

## 📚 Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [LiteLLM Architecture Guide](../docs/architecture.md)
- [Performance Optimization Guide](../docs/performance.md)

## 🤝 Contributing to Tests

When adding new tests:
1. Follow existing test structure and naming conventions
2. Include both positive and negative test cases
3. Add performance measurements for new features
4. Update this documentation with new test categories
5. Ensure tests are deterministic and reliable
