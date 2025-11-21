Feature: Dodawanie liczb z regułami

  Rule: Dodawanie liczb dodatnich
    Background:
      Given kalkulator jest zresetowany

    Scenario: Dodawanie liczb dodatnich 5 i 3
      When dodaję liczbę 5
      And dodaję liczbę 3
      Then wynik powinien być równy 8

  Rule: Dodawanie liczb ujemnych
    Background:
      Given kalkulator jest zresetowany

    Scenario Outline: Dodawanie różnych liczb <liczba1> i <liczba2>
      Given mam liczbę <liczba1>
      When dodaję liczbę <liczba2>
      Then wynik powinien być równy <wynik>

      Examples:
        | liczba1 | liczba2 | wynik |
        | 5       | 3       | 8     |
        | 10      | 7       | 17    |
