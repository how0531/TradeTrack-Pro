---
name: Taiwan Futures Master
description: An AI SKILL that provides domain knowledge for parsing and formatting Taiwan Futures (Taifex) codes.
version: 1.0
---

# Taiwan Futures Master Skill

## Purpose

To accurately parse, format, and explain Taiwan Futures Exchange (TAIFEX) product codes, including Monthly and Weekly contracts.

## Core Logic

### 1. Naming Structure

Standard format consists of: `[Product Code]` + `[Month/Week Code]` + `[Year Code]`

### 2. Product Codes

| Code    | Name            | Note                             |
| :------ | :-------------- | :------------------------------- |
| **TX**  | 台指期 (大台)   | Weekly prefix is often just `TX` |
| **MTX** | 小型台指 (小台) |                                  |
| **TE**  | 電子期          |                                  |
| **TF**  | 金融期          |                                  |
| **TXF** | 台指期 (標準)   | Standard monthly contract prefix |

### 3. Month Codes (Monthly Contracts)

TAIFEX uses A-L for Jan-Dec Futures.

| Month | Code  | Month | Code  |
| :---- | :---- | :---- | :---- |
| Jan   | **A** | Jul   | **G** |
| Feb   | **B** | Aug   | **H** |
| Mar   | **C** | Sep   | **I** |
| Apr   | **D** | Oct   | **J** |
| May   | **E** | Nov   | **K** |
| Jun   | **F** | Dec   | **L** |

_Example_: `TXFK5` = `TXF` (台指期) + `K` (Nov) + `5` (2025) -> **"台指期11"**

### 4. Weekly Contracts

Weekly contracts use a single digit `1-5` to represent the week of the month.

| Code  | Meaning |
| :---- | :------ |
| **1** | Week 1  |
| **2** | Week 2  |
| **3** | Week 3  |
| **4** | Week 4  |
| **5** | Week 5  |

_Special Rule_:

- `TX` + `Digit` usually denotes **Weekly Small Futures** (週小台) in many quoting systems, distinct from Big Futures.
- _Example_: `TX1` -> **"週小台W1"** (Not Big Futures Week 1)

### 5. Year Codes

Single digit representing the last digit of the year.

- `5` = 2025
- `6` = 2026
- `0` = 2030

## Regex Patterns

### Monthly Futures

Pattern: `^([A-Z]+)([A-L])(\d)$`

- Group 1: Product (e.g., `TXF`, `MTX`)
- Group 2: Month (A-L)
- Group 3: Year (0-9)

### Weekly Futures

Pattern: `^([A-Z]+)([1-5])$`

- Group 1: Product (e.g., `TX`, `MTX`)
- Group 2: Week (1-5)

## Implementation Guide (TypeScript)

When implementing parsers, use the following logic:

```typescript
export const parseFuturesCode = (code: string): string | null => {
  const cleanCode = code.toUpperCase().trim();

  // 1. Weekly Check
  const weeklyMatch = cleanCode.match(/^([A-Z]+)([1-5])$/);
  if (weeklyMatch) {
    const prefix = weeklyMatch[1];
    const week = weeklyMatch[2];
    // Special Case: TX + Digit = Weekly Small Futures
    if (prefix === "TX") return `週小台W${week}`;
    return `${getProductName(prefix)}週${week}`;
  }

  // 2. Monthly Check
  const monthlyMatch = cleanCode.match(/^([A-Z]+)([A-L])(\d)$/);
  if (monthlyMatch) {
    const prefix = monthlyMatch[1];
    const monthChar = monthlyMatch[2];
    const monthMap = {
      A: "01",
      B: "02",
      C: "03",
      D: "04",
      E: "05",
      F: "06",
      G: "07",
      H: "08",
      I: "09",
      J: "10",
      K: "11",
      L: "12",
    };
    return `${getProductName(prefix)}${monthMap[monthChar]}`;
  }
  return null;
};
```
