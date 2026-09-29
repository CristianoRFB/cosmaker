# ADR-0001 — Multi-tenant por ateliê

**Status:** aceito inicialmente.

Cada ateliê é um tenant. Dados operacionais ficam preferencialmente sob `ateliers/{atelierId}` e o acesso deve validar membership/role no backend e nas Security Rules.
