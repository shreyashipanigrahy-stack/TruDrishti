# Production Deployment Guide: TruDrishti Platform

This guide outlines the steps to deploy the containerized TruDrishti deepfake detector API, the Evidently AI monitoring dashboard, PostgreSQL database, and Nginx frontend server to a Kubernetes (production) environment.

---

## 1. System Requirements & Prerequisites

- **Kubernetes Cluster**: Version `1.26+` with an active Ingress Controller (e.g. `ingress-nginx`).
- **PostgreSQL**: Version `15+` (either self-hosted in-cluster or RDS/Cloud SQL).
- **Persistent Volume Provider**: Supporter of `ReadWriteMany (RWX)` for sharing Evidently reports across multiple pods (e.g., NFS, AWS EFS, Google Filestore).
- **Model Weight File**: The EfficientNet-B4 weights file `custom_b4_srm01.pth` (70.9MB) available on a persistent volume or downloaded during build.

---

## 2. Environment Configurations

Configure the following environment variables in your ConfigMap / Secret manifests:

```bash
# Database connection string (PostgreSQL)
DATABASE_URL=postgresql://<user>:<password>@postgres-service:5432/TruDrishtiDB

# JWT signing key (Min 32 characters, secure hex string)
JWT_SECRET=super-secure-production-jwt-key-change-me

# FastAPI Application Settings
PORT=8000
HOST=0.0.0.0
```

---

## 3. Deployment Steps

### Step 1: Create Namespace
```bash
kubectl create namespace trudrishti
```

### Step 2: Deploy PostgreSQL Database
Apply the persistent volume claims, deployments, and services:
```bash
kubectl apply -f k8s/postgres-pvc.yaml
kubectl apply -f k8s/postgres-deployment.yaml
kubectl apply -f k8s/postgres-service.yaml
```

### Step 3: Deploy the Backend API
The backend requires access to two mounts:
- **Weights Directory**: Read-only mount containing `custom_b4_srm01.pth` at `/app/custom_b4_srm01.pth`.
- **Reports Directory**: Read-write mount at `/app/reports` to store generated static HTML reports.

Apply the backend components:
```bash
kubectl apply -f k8s/backend-pvc.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml
```

*Note: The backend Docker container automatically runs `alembic upgrade head` at startup, ensuring that all tables (including `evidently_reports`) are created/upgraded before accepting requests.*

### Step 4: Configure Routing & Ingress
Apply the ingress controller specifications to route traffic to the Nginx frontend and FastAPI backend:
```bash
kubectl apply -f k8s/ingress.yaml
```

---

## 4. Scaling & Monitoring Best Practices

1. **Horizontal Pod Autoscaling (HPA)**:
   - Scale backend pods based on CPU/Memory usage (e.g., Target CPU = 75%).
   - Since the model inference utilizes PyTorch, ensure that memory limits are sized appropriately (min `2Gi` per pod).
2. **Persistent Volume Claim**:
   - Ensure the PV mounted at `/app/reports` is a shared file system (RWX). If using ReadWriteOnce (RWO), scaling backend pods past 1 will lead to volume mounting failures.
3. **Database Maintenance**:
   - Run regular indices maintenance on the `inferences` and `evidently_reports` tables to optimize pagination queries.
