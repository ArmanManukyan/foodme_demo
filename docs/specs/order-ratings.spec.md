# PRD: Order Ratings

## 1. Overview

FoodMe customers will be able to rate orders they have received with 1 to 5 stars and an
optional comment. Each chef's star rating on the storefront will then come from real
customer feedback, and the operations team will see every rating in the admin panel.

## 2. Problem

- The chef ratings shown on the storefront are static. They were set once and never change,
  so they don't reflect what customers actually experience.
- Customers have no way to tell FoodMe how an order went.
- FoodMe has no signal about chef quality, so the operations team can't spot or follow up on
  bad experiences.

## 3. Goals

- Build trust with new customers by showing chef ratings based on real orders.
- Give customers a simple way to share feedback on an order they received.
- Give the operations team a quality signal for every chef and every order.

## 4. Users

| User | Need |
|---|---|
| **Customer** | Rate an order they received and see the ratings they've already given. |
| **Prospective customer** | Choose a chef based on how other customers rated them. |
| **Operations team** | See how each order was rated so they can follow up on bad experiences. |

## 5. User stories

1. As a customer who received an order, I want to rate it with 1–5 stars and an optional
   comment, so that other customers can pick great chefs and FoodMe knows how the chef performed.
2. As a customer looking at my order history, I want a clear way to rate each delivered order,
   and to see the ratings I've already given.
3. As someone browsing chefs, I want each chef's rating to reflect real customer ratings, so I
   can trust it when choosing.
4. As a member of the operations team, when I open an order in the admin panel I want to see how
   the customer rated it, so I can follow up on bad experiences.

## 6. Requirements

### 6.1 The rating

| ID | Requirement |
|---|---|
| R1 | A rating is given for one order. It records the order, the customer who gave it, the chef who prepared the order, and the date and time it was given. |
| R2 | A rating has 1 to 5 stars, as a whole number. No other value is allowed. |
| R3 | A rating can have an optional comment of up to 1000 characters. |
| R4 | An order can have at most one rating. |
| R5 | Ratings are kept permanently. |

### 6.2 Who can rate

| ID | Requirement |
|---|---|
| R6 | Only signed-in customers can rate. |
| R7 | A customer can rate only orders they placed themselves. If they try to rate someone else's order, FoodMe behaves as if that order doesn't exist. |
| R8 | Only delivered orders can be rated. For any other order the customer sees: **"Only delivered orders can be reviewed."** |
| R9 | An order can be rated only once. A second attempt shows: **"Order already reviewed."** |

### 6.3 Chef rating

| ID | Requirement |
|---|---|
| R10 | Each time a rating is saved, the chef's rating becomes the average of all the ratings the chef has received. |
| R11 | The chef's rating is rounded to one decimal place, e.g. 4.3. |
| R12 | The storefront shows the updated chef rating straight away. |

### 6.4 Where ratings appear

| ID | Requirement |
|---|---|
| R13 | Wherever an order's details are shown (My Orders, order tracking and the admin panel), its rating and comment are shown too, if the order has been rated. |

### 6.5 Customer experience: My Orders

| ID | Requirement |
|---|---|
| R14 | Every delivered order that hasn't been rated shows a **Rate order** button. |
| R15 | Orders that haven't been delivered show no rating option. |
| R16 | **Rate order** opens a small window with 5 stars and an optional comment box with the hint "Tell us about your order". |
| R17 | After the customer submits, the window closes and the order shows the stars they gave in place of the button. |
| R18 | If the rating can't be saved, the window shows the reason and lets the customer try again. |
| R19 | The rating is still shown after the customer refreshes the page or comes back later. |

### 6.6 Operations experience: admin panel

| ID | Requirement |
|---|---|
| R20 | The order details page has a **Customer review** section showing the stars, the comment and the date of the rating. |
| R21 | For a delivered order that hasn't been rated yet, the section says **"No review yet"**. |
| R22 | For orders that haven't been delivered, the section is hidden. |
| R23 | *Nice to have:* the order list shows a small star rating next to each rated order. |

### 6.7 Quality requirements

| ID | Requirement |
|---|---|
| R24 | The stars work with mouse, touch and keyboard, and screen readers can read them. |
| R25 | My Orders and the rating window look right on mobile and desktop. |
| R26 | Ratings survive app restarts and new releases. |
| R27 | All existing data and features keep working exactly as before. |

## 7. Acceptance criteria

The feature is done when:

1. A customer can rate a delivered order from start to finish and still sees the rating after refreshing the page.
2. A customer can't rate an order that isn't delivered, can't rate the same order twice, and can't rate someone else's order.
3. Ratings outside 1 to 5 whole stars, and comments longer than 1000 characters, are refused.
4. Someone who isn't signed in can't rate.
5. A chef's rating on the storefront is the average of their customer ratings, rounded to one decimal.
6. The operations team can see the stars, comment and date of every rated order in the admin panel.
7. Everything that worked before still works.

## 8. Out of scope

These are not part of this release:

- Editing or deleting a rating
- Showing written comments publicly on the chef's page
- Rating individual dishes
- Moderating comments
