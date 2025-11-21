Feature: Dodawanie liczb z Background

  Background:
    Given kalkulator jest zresetowany
    And wartość początkowa to 10

  Scenario: Dodawanie wielu liczb
    When dodaję liczbę 5
    And dodaję liczbę 3
    And dodaję liczbę 2
    Then wynik powinien być równy 20
