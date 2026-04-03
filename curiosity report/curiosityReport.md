# Chaos Engineering and Load Testing Report: JWT Pizza Service


## Introduction
I was curious about chaos engineering so I decided to reasearch about it. I tried to learn about what would actually happen if my deployed system failed under a real load. In class we will learn about chaos testing at the application level, but I wanted to go further and test how my full system behaves in AWS when something actually breaks.


## Objective
Evaluate the reliability of the JWT Pizza system under load and controlled failure conditions and identify practical resilience improvements.


## Hypothesis
- If a single ECS task fails, the system will temporarily degrade but recover automatically  
- The load balancer should reroute traffic  
- Some requests may fail, but the system should stabilize quickly  



## Test Setup Summary

Tool: Grafana K6, AWS

Main user path tested:
- PUT /api/auth (login)
- GET /api/order/menu
- POST /api/order (purchase)
- POST /api/order/verify

Load profile:
- ramp to 20 VUs  
- hold  
- ramp down  

Chaos event:
- manually stopped a running ECS task for jwt-pizza-service  



## Experiment 1: Baseline Load Test (No Chaos)
Initial failures were caused by incorrect test setup then after fixing this the system behaved correctly under normal load.


### Results
- Requests: ~3,420  
- p95 latency: ~420 ms  
- All critical endpoints returned 200  
- Checks: passing  

### Interpretation
The system is stable under normal load when the test is configured correctly.



## Experiment 2: Chaos Test (Stop ECS Task During Load)
### Fault injected
I manually stopped a running ECS task while the load test was active.

### Results
- Requests: ~21,000  
- Failures: ~17,900  
- Peak RPS: ~804  
- p95 latency: ~91 ms  

Main issue:
- /api/auth returned a large number of 503 errors  


### Observations
- The system failed heavily once the task was stopped  
- Auth failure caused other parts of the system to fail  
- Very low latency was misleading because errors returned quickly  


### Screenshots
![K6 Results](./Screenshot%202026-04-02%20at%2011.27.55PM.png)
![ECS Task Stopped](./Screenshot%202026-04-02%20at%2011.27.55PM.png)



## Recovery Behavior
- Desired tasks returned to 1  
- Full recovery took about 2 minutes  

### Interpretation
The system recovers but there is a significant period where users may experience failures.


## What Surprised Me
- The system failed much more than I expected from just one task stopping  
- Failures spread quickly across endpoints, especially auth  
- Low latency during failure made the system look “fast” even though it was broken  
- Recovery took longer than I thought  



## Key Lessons Learned
- Always validate your test setup before judging system behavior  
- One task deployments are risky and can create a failure  
- The system depends heavily on auth which creates cascading failures  
- Logs are essential to understand what is happening  



## Recommendations
- Run the service with at least 2 tasks can help the system to have less errors
- Add alerts for:
  - auth 5xx errors  
  - sudden failure spikes  
  - unhealthy task count  
- Continue running chaos tests regularly  
- Improve monitoring and visibility  



## Conclusion
The JWT Pizza service performed great under normal conditions but chaos testing showed me that it is sensitive to failure when running with a single ECS task, these chaos testing helped learn that a system can be very fragile and these hard tests are good to find breaking points and improvements can be made to increase resilience of the website.