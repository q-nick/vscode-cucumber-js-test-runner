Feature: Dodawanie liczb z różnymi wartościami

  Scenario Outline: Dodawanie różnych liczb <liczba1> i <liczba2>
    Given mam liczbę <liczba1>
    When dodaję liczbę <liczba2>
    Then wynik powinien być równy <wynik>

    Examples:
      | liczba1 | liczba2 | wynik |
      | 5       | 3       | 8     |
      | 10      | 7       | 17    |

